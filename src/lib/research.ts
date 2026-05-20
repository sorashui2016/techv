import type {
  ExploreCandidate,
  Platform,
  Prisma,
  ResearchAssetType,
  ResearchEntryType,
  ResearchProject,
  ResearchProjectStatus,
  ResearchSupplementType,
  VideoItem,
} from "@prisma/client";
import { execFile } from "node:child_process";
import { readdir, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "./db";
import { downloadResearchMedia, extractVideo } from "./yt-dlp";

const execFileAsync = promisify(execFile);
const MATERIAL_ROOT = "project_materials";

function shanghaiDateText(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type CreateResearchProjectInput = {
  entryType: ResearchEntryType;
  originalUrl: string;
  platform?: Platform | null;
  sourceVideoId?: string;
  exploreCandidateId?: string;
  title?: string | null;
  summary?: string | null;
  supplementalText?: string | null;
};

type ResearchContext = {
  project: ResearchProject;
  video?: VideoItem | null;
  candidate?: ExploreCandidate | null;
  supplements: Array<{ type: ResearchSupplementType; content: string }>;
};

type SavedFile = {
  type: ResearchAssetType;
  localPath: string;
  title: string;
};

const reportSchemaPrompt = `
请生成一篇中文科技选题研究综述，使用 Markdown。
禁止使用 Markdown 表格。不要输出带竖线的表格。并列信息请用“字段：内容、内容、内容”的形式，或使用普通项目符号列表。
不要使用 Markdown 加粗、斜体、复选框或任务列表。不要输出 **加粗**、__加粗__、[ ]、[x] 这类符号。
不要自行编写“报告生成时间”。报告生成时间由系统自动添加。
报告必须包含：
1. 一句话说明这个内容是什么
2. 详细介绍
3. 涉及的产品 / 技术 / 新闻
4. 核心技术原理
5. 历史背景和发展脉络
6. 相关人物、公司、机构、团队
7. 行业背景和应用场景
8. 作用和价值
9. 竞品或相关案例
10. 争议点、风险和不确定性
11. 对普通人的意义
12. 适合做视频的角度
13. 需要继续核查的问题
14. 是否建议进入素材搜索阶段
15. 来源清单：必须列出信息来源标题和 URL。没有 URL 的来源不要编造链接，只能写“待补充来源链接”。
`;

export function detectResearchPlatform(url: string): Platform {
  if (/youtu\.?be|youtube\.com/i.test(url)) return "YOUTUBE";
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return "XIAOHONGSHU";
  if (/channels\.weixin\.qq\.com|weixin\.qq\.com|wechat/i.test(url)) return "WECHAT_VIDEO";
  if (/instagram\.com/i.test(url)) return "INSTAGRAM";
  if (/tiktok\.com/i.test(url)) return "TIKTOK";
  return "WEB";
}

function needsSupplement(platform?: Platform | null) {
  return platform === "XIAOHONGSHU" || platform === "WECHAT_VIDEO";
}

export async function createResearchProject(input: CreateResearchProjectInput) {
  const platform = input.platform ?? detectResearchPlatform(input.originalUrl);
  const existing = await prisma.researchProject.findFirst({
    where: {
      OR: [
        input.sourceVideoId ? { sourceVideoId: input.sourceVideoId } : undefined,
        input.exploreCandidateId ? { exploreCandidateId: input.exploreCandidateId } : undefined,
        { originalUrl: input.originalUrl, entryType: input.entryType },
      ].filter(Boolean) as Prisma.ResearchProjectWhereInput[],
    },
  });
  if (existing) return existing;

  const project = await prisma.researchProject.create({
    data: {
      entryType: input.entryType,
      originalUrl: input.originalUrl,
      platform,
      sourceVideoId: input.sourceVideoId,
      exploreCandidateId: input.exploreCandidateId,
      title: input.title,
      summary: input.summary,
      status: needsSupplement(platform) && !input.supplementalText ? "NEEDS_SUPPLEMENT" : "TODO",
    },
  });

  if (input.supplementalText?.trim()) {
    await prisma.researchSupplement.create({
      data: {
        projectId: project.id,
        type: "BODY",
        content: input.supplementalText.trim(),
        notes: "手动提交研究链接时附带的补充材料。",
      },
    });
    return prisma.researchProject.update({
      where: { id: project.id },
      data: { status: "SUPPLEMENT_SUBMITTED" },
    });
  }

  return project;
}

export async function createResearchProjectFromVideo(videoId: string) {
  const video = await prisma.videoItem.findUniqueOrThrow({ where: { id: videoId } });
  return createResearchProject({
    entryType: "RADAR_CARD",
    originalUrl: video.originalUrl,
    platform: video.platform,
    sourceVideoId: video.id,
    title: video.chineseTitle ?? video.originalTitle,
    summary: video.chineseSummary,
  });
}

export async function createResearchProjectFromExploreCandidate(candidateId: string) {
  const candidate = await prisma.exploreCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  const project = await createResearchProject({
    entryType: "EXPLORE_CARD",
    originalUrl: candidate.originalUrl,
    platform: candidate.platform,
    exploreCandidateId: candidate.id,
    title: candidate.chineseTitle ?? candidate.originalTitle,
    summary: candidate.chineseSummary,
  });

  await prisma.exploreCandidate.update({
    where: { id: candidate.id },
    data: { status: "RESEARCH" },
  });

  return project;
}

export async function addResearchSupplement(
  projectId: string,
  type: ResearchSupplementType,
  content: string,
  notes?: string,
) {
  await prisma.researchSupplement.create({
    data: { projectId, type, content, notes },
  });

  return prisma.researchProject.update({
    where: { id: projectId },
    data: { status: "SUPPLEMENT_SUBMITTED", errorMessage: null },
  });
}

function fallbackReport(context: ResearchContext, reason?: string) {
  const title =
    context.project.title ??
    context.video?.chineseTitle ??
    context.video?.originalTitle ??
    context.candidate?.chineseTitle ??
    context.candidate?.originalTitle ??
    "待研究链接";
  const summary =
    context.project.summary ??
    context.video?.chineseSummary ??
    context.candidate?.chineseSummary ??
    "自动研究暂未获得足够信息，请补充标题、正文、字幕或转写文本。";
  const supplementText = context.supplements
    .map((item) => `- ${item.type}: ${item.content.slice(0, 500)}`)
    .join("\n");

  return [
    `# ${title}`,
    "",
    "## 一句话说明",
    summary,
    "",
    "## 当前可用信息",
    `- 原始链接：${context.project.originalUrl}`,
    `- 平台：${context.project.platform ?? "未知"}`,
    supplementText || "- 暂无补充材料。",
    "",
    "## 初步判断",
    "当前版本已创建研究项目。小红书、视频号或解析不足的链接需要补充标题、正文、字幕、转写文本或截图说明后继续研究。",
    "",
    "## 需要继续核查的问题",
    "- 产品、技术或新闻事件的准确名称是什么？",
    "- 是否存在官网、新闻稿、论文、权威媒体报道或品牌资料？",
    "- 这个内容是否有足够视觉素材支撑视频制作？",
    "",
    "## 是否建议进入素材搜索阶段",
    "暂不建议。请先完成文字研究和事实核查。",
    reason ? `\n> 自动研究暂时使用兜底报告：${reason}` : "",
  ].join("\n");
}

async function callResearchModel(context: ResearchContext) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("Minimax API key 未配置");

  const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.chat/v1/text/chatcompletion_v2";
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.7-highspeed";
  const groupId = process.env.MINIMAX_GROUP_ID;
  const url = groupId ? `${apiUrl}?GroupId=${groupId}` : apiUrl;
  const supplements = context.supplements
    .map((item) => `【${item.type}】\n${item.content}`)
    .join("\n\n");
  const sourceList = buildSourceList(context.project, context.supplements)
    .map((source) => `- ${source.title}: ${source.url}`)
    .join("\n");

  const prompt = [
    "你是科技内容研究员。用户给你的补充材料可能来自音频转写，可能有错别字、同音字、断句错误、人名品牌名识别错误。请先清洗理解，再提取研究对象，并在报告中标出需要核查的点。",
    "不要编造来源链接。如果缺少全网资料，只能基于现有材料形成初稿，并明确需要继续核查。",
    "报告中的事实性信息必须尽量对应到来源清单中的 URL；来源清单必须保留可点击链接。",
    reportSchemaPrompt,
    "",
    `入口类型：${context.project.entryType}`,
    `平台：${context.project.platform ?? "未知"}`,
    `原始链接：${context.project.originalUrl}`,
    `标题：${context.project.title ?? context.video?.originalTitle ?? context.candidate?.originalTitle ?? ""}`,
    `摘要：${context.project.summary ?? context.video?.chineseSummary ?? context.candidate?.chineseSummary ?? ""}`,
    `描述：${context.video?.description ?? context.candidate?.description ?? ""}`,
    "",
    "用户补充材料：",
    supplements || "暂无",
    "",
    "当前已知来源链接：",
    sourceList || "暂无",
  ].join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          name: "Research",
          content: "你是严谨的科技选题研究员，输出中文 Markdown 研究报告。",
        },
        { role: "user", name: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 4000,
    }),
  });

  if (!response.ok) throw new Error(`Minimax research failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`Minimax research failed: ${data.base_resp.status_msg}`);
  }

  const text =
    data?.reply ??
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("Minimax research response was empty");
  return sanitizeResearchReport(text.trim());
}

function inferOneLine(report: string) {
  const line = report
    .split(/\r?\n/)
    .map((item) => item.replace(/^#+\s*/, "").trim())
    .find((item) => item && !item.startsWith("-") && !item.startsWith(">"));
  return line?.slice(0, 120) ?? "已生成研究报告";
}

export function sanitizeResearchReport(report: string) {
  const lines = report.split(/\r?\n/);
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const next = lines[index + 1]?.trim() ?? "";
    const isTableHeader =
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(next);

    if (isTableHeader) {
      const headers = trimmed
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 2;

      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const cells = lines[index]
          .trim()
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean);
        const parts = cells.map((cell, cellIndex) => {
          const header = headers[cellIndex] ?? `字段${cellIndex + 1}`;
          return `${header}：${cell}`;
        });
        output.push(`- ${parts.join("；")}`);
        index += 1;
      }

      index -= 1;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      if (cells.length > 0) {
        output.push(`- ${cells.join("、")}`);
        continue;
      }
    }

    output.push(line);
  }

  return output
    .join("\n")
    .replace(/^报告生成时间\s*[:：].*$/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .split(/\r?\n/)
    .map(cleanFieldLabelNoise)
    .join("\n")
    .replace(/^(\s*[-*]\s*)\[[ xX]\]\s*/gm, "$1")
    .replace(/^\s*\[\s*[xX]?\s*\]\s*/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function normalizeResearchReport(report: string, date = new Date()) {
  const cleaned = sanitizeResearchReport(report);
  return [`报告生成时间：${shanghaiDateText(date)}`, "", cleaned].join("\n").trim();
}

function cleanFieldLabelNoise(line: string) {
  if (!line.trim().startsWith("-")) return line;

  return line
    .replace(/([；;、]\s*)?(类别|类型|具体内容|内容方向|名称|说明|角度|字段\d+)\s*[:：]\s*/g, (match, separator: string | undefined) =>
      separator ? separator.replace(/[；;]\s*/, "、") : "",
    )
    .replace(/^\s*-\s*[、；;]\s*/, "- ")
    .replace(/[、；;]\s*[、；;]+/g, "、")
    .replace(/\s*、\s*/g, "、")
    .replace(/\s*；\s*/g, "；")
    .replace(/、\s*$/g, "");
}

function extractUrls(text: string) {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)\]，。；、"'<>]+/g) ?? []));
}

function buildSourceList(project: ResearchProject, supplements: Array<{ type: ResearchSupplementType; content: string }>) {
  const sources: Array<{ title: string; url: string; type: string }> = [
    { title: "原始链接", url: project.originalUrl, type: "original" },
  ];

  for (const supplement of supplements) {
    for (const url of extractUrls(supplement.content)) {
      sources.push({
        title: `补充材料链接：${url}`,
        url,
        type: supplement.type,
      });
    }
  }

  return sources;
}

async function nextReportVersionNumber(projectId: string) {
  const latest = await prisma.researchReportVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
  });
  return (latest?.versionNumber ?? 0) + 1;
}

async function saveCurrentReportVersion(input: {
  projectId: string;
  reportMarkdown: string;
  sourceList: Array<{ title: string; url: string; type: string }>;
  userInstruction?: string;
  theme?: string;
}) {
  const versionNumber = await nextReportVersionNumber(input.projectId);

  await prisma.researchReportVersion.updateMany({
    where: { projectId: input.projectId, isCurrent: true },
    data: { isCurrent: false },
  });

  return prisma.researchReportVersion.create({
    data: {
      projectId: input.projectId,
      versionNumber,
      userInstruction: input.userInstruction,
      theme: input.theme,
      reportMarkdown: input.reportMarkdown,
      sourceList: input.sourceList,
      isCurrent: true,
    },
  });
}

function fallbackIterationReport(project: ResearchProject, currentReport: string, instruction: string, reason?: string) {
  return [
    `# ${project.title ?? project.researchTarget ?? "研究主题迭代"}`,
    "",
    "## 1. 本轮调整目标",
    instruction,
    "",
    "## 2. 新确认或候选主题",
    "当前需要把原始视频研究继续扩展为更明确的视频主题。请继续补充官网、新闻稿、权威媒体、产品页或用户提供资料后重新生成。",
    "",
    "## 3. 和上一版相比改变了什么",
    "本轮已经记录新的研究方向，但自动模型暂时不可用，因此先保留上一版报告作为参考。",
    "",
    "## 4. 上一版报告摘要",
    currentReport.slice(0, 3000),
    "",
    "## 5. 还需要继续查什么",
    "- 新主题涉及哪些产品、技术、公司或案例",
    "- 是否有官网、发布稿、演示视频、论文或权威报道",
    "- 哪些内容适合做成合集，哪些只适合作为辅助素材",
    "",
    "## 6. 来源链接",
    `- 原始链接：${project.originalUrl}`,
    reason ? `\n自动迭代暂时使用兜底报告：${reason}` : "",
  ].join("\n");
}

async function callIterationModel(input: {
  project: ResearchProject;
  currentReport: string;
  userInstruction: string;
  supplements: Array<{ type: ResearchSupplementType; content: string }>;
}) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("Minimax API key 未配置");

  const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.chat/v1/text/chatcompletion_v2";
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.7-highspeed";
  const groupId = process.env.MINIMAX_GROUP_ID;
  const url = groupId ? `${apiUrl}?GroupId=${groupId}` : apiUrl;
  const sourceList = buildSourceList(input.project, input.supplements)
    .map((source) => `- ${source.title}: ${source.url}`)
    .join("\n");
  const supplements = input.supplements
    .map((item) => `【${item.type}】\n${item.content}`)
    .join("\n\n");

  const prompt = [
    "你是科技选题研究员。用户已经有一版研究报告，现在提出新的调整方向。",
    "请基于上一版报告、用户的新方向、补充材料和来源链接，生成一版新的中文研究报告。",
    "这不是简单续写，而是一次研究主题迭代：可以收窄、扩展、改成合集、改成对比、改成产品线梳理。",
    "不要使用 Markdown 表格，不要使用加粗星号，不要输出复选框，不要自己编写报告生成时间。",
    "不要编造来源链接。报告最后必须列出来源链接；没有 URL 的事实请标为待核查。",
    "",
    "新版报告必须包含：",
    "1. 本轮调整目标",
    "2. 新确认或候选主题",
    "3. 新增资料方向",
    "4. 和上一版相比改变了什么",
    "5. 详细综述",
    "6. 适合做视频的角度",
    "7. 可作为素材线索的内容",
    "8. 还需要继续核查的问题",
    "9. 是否建议确认主题并进入素材搜索",
    "10. 来源链接",
    "",
    `原始链接：${input.project.originalUrl}`,
    `当前标题：${input.project.title ?? ""}`,
    `用户本轮调整方向：${input.userInstruction}`,
    "",
    "上一版报告：",
    input.currentReport.slice(0, 16000),
    "",
    "补充材料：",
    supplements || "暂无",
    "",
    "已知来源链接：",
    sourceList || "暂无",
  ].join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          name: "ResearchIteration",
          content: "你是严谨的科技选题研究员，负责把已有报告按用户新方向迭代成新版报告。",
        },
        { role: "user", name: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 5000,
    }),
  });

  if (!response.ok) throw new Error(`Minimax iteration failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`Minimax iteration failed: ${data.base_resp.status_msg}`);
  }

  const text =
    data?.reply ??
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("Minimax iteration response was empty");
  return sanitizeResearchReport(text.trim());
}

function safeProjectName(project: ResearchProject) {
  let host = "ResearchProject";
  try {
    host = new URL(project.originalUrl).hostname;
  } catch {
    // Use fallback below.
  }

  const raw = project.title ?? project.researchTarget ?? host;
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 36);
  return cleaned || "ResearchProject";
}

async function ensureProjectFolders(project: ResearchProject) {
  const folder = path.join(MATERIAL_ROOT, `${project.id.slice(0, 8)}_${safeProjectName(project)}`);
  const folders = [
    folder,
    path.join(folder, "videos"),
    path.join(folder, "audio"),
    path.join(folder, "images"),
    path.join(folder, "transcripts"),
    path.join(folder, "translations"),
    path.join(folder, "docs"),
    path.join(folder, "links"),
  ];

  for (const item of folders) {
    await mkdir(item, { recursive: true });
  }

  return folder;
}

function assetTypeFromFile(filePath: string): ResearchAssetType {
  const ext = path.extname(filePath).toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".webm"].includes(ext)) return "VIDEO";
  if ([".m4a", ".mp3", ".wav", ".aac", ".opus"].includes(ext)) return "AUDIO";
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "IMAGE";
  if ([".srt", ".vtt", ".ass", ".ssa"].includes(ext)) return "SUBTITLE";
  if ([".txt", ".md"].includes(ext)) return "TRANSCRIPT";
  return "OTHER";
}

async function listFiles(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function saveAssets(projectId: string, files: SavedFile[], sourceUrl: string) {
  for (const file of files) {
    const existing = await prisma.researchAsset.findFirst({
      where: { projectId, localPath: file.localPath },
    });
    if (existing) continue;

    await prisma.researchAsset.create({
      data: {
        projectId,
        type: file.type,
        title: file.title,
        sourceUrl,
        localPath: file.localPath,
        notes:
          file.type === "SUBTITLE"
            ? "自动下载到的字幕文件，已作为研究补充材料。"
            : "自动解析阶段保存的媒体文件。",
      },
    });
  }
}

async function addSubtitleSupplements(projectId: string, files: string[]) {
  const subtitleFiles = files.filter((file) => assetTypeFromFile(file) === "SUBTITLE");

  for (const file of subtitleFiles.slice(0, 3)) {
    try {
      const content = await readFile(file, "utf8");
      if (!content.trim()) continue;
      await prisma.researchSupplement.create({
        data: {
          projectId,
          type: "SUBTITLE",
          content: content.slice(0, 20_000),
          notes: `自动下载字幕：${file}`,
        },
      });
    } catch {
      // Keep the asset even if text reading fails.
    }
  }
}

async function extractAudioAndKeyframe(projectId: string, projectFolder: string, files: string[], sourceUrl: string) {
  const videoFile = files.find((file) => assetTypeFromFile(file) === "VIDEO");
  if (!videoFile) return;

  const saved: SavedFile[] = [];
  const audioPath = path.join(projectFolder, "audio", "001_extracted_audio.m4a");
  const keyframePath = path.join(projectFolder, "images", "001_keyframe.jpg");

  try {
    await execFileAsync("ffmpeg", ["-y", "-i", videoFile, "-vn", "-acodec", "copy", audioPath], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    saved.push({ type: "AUDIO", localPath: audioPath, title: "自动提取音频" });
  } catch {
    await prisma.researchAsset.create({
      data: {
        projectId,
        type: "AUDIO",
        status: "FAILED",
        sourceUrl,
        notes: "ffmpeg 音频提取失败；可后续手动上传音频或检查 ffmpeg。",
      },
    });
  }

  try {
    await execFileAsync("ffmpeg", ["-y", "-ss", "00:00:03", "-i", videoFile, "-frames:v", "1", keyframePath], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    saved.push({ type: "KEYFRAME", localPath: keyframePath, title: "自动提取关键帧" });
  } catch {
    await prisma.researchAsset.create({
      data: {
        projectId,
        type: "KEYFRAME",
        status: "FAILED",
        sourceUrl,
        notes: "ffmpeg 关键帧提取失败；可后续手动上传截图。",
      },
    });
  }

  if (saved.length > 0) await saveAssets(projectId, saved, sourceUrl);
}

async function tryPublicMediaAnalysis(project: ResearchProject) {
  const existingAssets = await prisma.researchAsset.count({ where: { projectId: project.id } });
  if (existingAssets > 0) return;

  const projectFolder = await ensureProjectFolders(project);
  const outputTemplate = path.join(projectFolder, "videos", "source.%(ext)s");

  try {
    await downloadResearchMedia(project.originalUrl, outputTemplate);
    const files = await listFiles(projectFolder);
    const saved = files.map((file) => ({
      type: assetTypeFromFile(file),
      localPath: file,
      title: path.basename(file),
    }));
    await saveAssets(project.id, saved, project.originalUrl);
    await addSubtitleSupplements(project.id, files);
    await extractAudioAndKeyframe(project.id, projectFolder, files, project.originalUrl);

    await prisma.researchSupplement.create({
      data: {
        projectId: project.id,
        type: "NOTE",
        content:
          "系统已尝试公开下载该链接的视频/字幕，并提取音频与关键帧。当前版本会保存这些文件和字幕文本；完整语音转写和画面理解将在后续接入。",
        notes: "自动媒体解析说明",
      },
    });

    await prisma.researchProject.update({
      where: { id: project.id },
      data: { projectFolderPath: projectFolder },
    });
  } catch (error) {
    await prisma.researchAsset.create({
      data: {
        projectId: project.id,
        type: "VIDEO",
        status: "NEEDS_MANUAL_UPLOAD",
        sourceUrl: project.originalUrl,
        notes:
          error instanceof Error
            ? `公开下载失败：${error.message.slice(0, 500)}。请手动上传视频、音频、截图或粘贴转写文本。`
            : "公开下载失败。请手动上传视频、音频、截图或粘贴转写文本。",
      },
    });
  }
}

export async function runResearchProject(projectId: string) {
  await prisma.researchProject.update({
    where: { id: projectId },
    data: { status: "UNDERSTANDING", errorMessage: null },
  });

  const project = await prisma.researchProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { sourceVideo: true, exploreCandidate: true, supplements: true },
  });

  let title = project.title;
  let summary = project.summary;
  let platform = project.platform;
  let status: ResearchProjectStatus = "WRITING_REPORT";

  if (project.entryType === "MANUAL_LINK" && (!title || !summary)) {
    try {
      const video = await extractVideo(project.originalUrl);
      title = title ?? video.originalTitle;
      summary = summary ?? video.description?.slice(0, 500) ?? null;
      platform = video.platform;
    } catch {
      status = "NEEDS_SUPPLEMENT";
    }
  }

  if (needsSupplement(platform)) {
    await tryPublicMediaAnalysis({ ...project, platform, title, summary });
  }

  const supplements = await prisma.researchSupplement.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  if (needsSupplement(platform) && supplements.length === 0) {
    return prisma.researchProject.update({
      where: { id: projectId },
      data: {
        platform,
        title,
        summary,
        status: "NEEDS_SUPPLEMENT",
        errorMessage: "该平台自动解析不足，请补充标题、正文、字幕、转写文本、评论或相关链接。",
      },
    });
  }

  await prisma.researchProject.update({
    where: { id: projectId },
    data: { platform, title, summary, status },
  });

  const context: ResearchContext = {
    project: { ...project, platform, title, summary },
    video: project.sourceVideo,
    candidate: project.exploreCandidate,
    supplements: supplements.map((item) => ({ type: item.type, content: item.content })),
  };

  let report: string;
  try {
    report = await callResearchModel(context);
  } catch (error) {
    report = fallbackReport(context, error instanceof Error ? error.message : "未知错误");
  }
  report = normalizeResearchReport(report);
  const finalSourceList = buildSourceList({ ...project, platform, title, summary }, supplements);

  const updatedProject = await prisma.researchProject.update({
    where: { id: projectId },
    data: {
      status: "REVIEW_PENDING",
      materialStatus: "NOT_STARTED",
      title,
      summary,
      oneLineConclusion: inferOneLine(report),
      reportMarkdown: report,
      sourceList: finalSourceList,
      recommendation: report.includes("建议进入素材搜索") ? "建议继续判断素材价值" : "待人工确认",
      errorMessage: null,
    },
  });

  await saveCurrentReportVersion({
    projectId,
    reportMarkdown: report,
    sourceList: finalSourceList,
    userInstruction: "初始链接研究",
    theme: updatedProject.researchTarget ?? updatedProject.title ?? updatedProject.oneLineConclusion ?? undefined,
  });

  return updatedProject;
}

export async function iterateResearchProject(projectId: string, userInstruction: string) {
  const instruction = userInstruction.trim();
  if (!instruction) throw new Error("请填写本轮希望继续研究或调整的方向");

  await prisma.researchProject.update({
    where: { id: projectId },
    data: { status: "ITERATING", errorMessage: null },
  });

  const project = await prisma.researchProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { supplements: true },
  });
  const currentReport = project.reportMarkdown ?? "暂无上一版报告。";
  const supplements = project.supplements.map((item) => ({ type: item.type, content: item.content }));

  let report: string;
  try {
    report = await callIterationModel({
      project,
      currentReport,
      userInstruction: instruction,
      supplements,
    });
  } catch (error) {
    report = fallbackIterationReport(
      project,
      currentReport,
      instruction,
      error instanceof Error ? error.message : undefined,
    );
  }

  report = normalizeResearchReport(report);
  const finalSourceList = buildSourceList(project, supplements);

  const updatedProject = await prisma.researchProject.update({
    where: { id: projectId },
    data: {
      status: "REVIEW_PENDING",
      materialStatus: "NOT_STARTED",
      oneLineConclusion: inferOneLine(report),
      reportMarkdown: report,
      sourceList: finalSourceList,
      recommendation: "已生成新版研究报告，请确认主题后再进入素材搜索。",
      errorMessage: null,
    },
  });

  await saveCurrentReportVersion({
    projectId,
    reportMarkdown: report,
    sourceList: finalSourceList,
    userInstruction: instruction,
    theme: instruction.slice(0, 120),
  });

  return updatedProject;
}

export async function confirmResearchReportVersion(versionId: string) {
  const version = await prisma.researchReportVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { project: true },
  });

  await prisma.researchReportVersion.updateMany({
    where: { projectId: version.projectId },
    data: { isFinal: false, isCurrent: false },
  });

  await prisma.researchReportVersion.update({
    where: { id: version.id },
    data: { isFinal: true, isCurrent: true },
  });

  return prisma.researchProject.update({
    where: { id: version.projectId },
    data: {
      status: "THEME_CONFIRMED",
      materialStatus: "READY_TO_SEARCH",
      researchTarget: version.theme ?? version.project.researchTarget,
      reportMarkdown: version.reportMarkdown,
      sourceList: (version.sourceList ?? version.project.sourceList ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      oneLineConclusion: inferOneLine(version.reportMarkdown),
      recommendation: "主题已确认，可以进入素材搜索阶段。",
      errorMessage: null,
    },
  });
}
