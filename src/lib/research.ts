import type {
  ExploreCandidate,
  Platform,
  Prisma,
  ResearchAssetType,
  ResearchEntryType,
  ResearchMaterialType,
  ResearchProject,
  ResearchProjectStatus,
  ResearchSupplementType,
  VideoItem,
} from "@prisma/client";
import { execFile } from "node:child_process";
import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "./db";
import { analyzeVideoWithMinimax } from "./minimax";
import { downloadResearchMedia, downloadResearchSubtitles, extractVideo, searchYouTubeVideos } from "./yt-dlp";

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
  videoUnderstanding?: string;
  searchQueries?: string[];
  webSources?: ResearchWebSource[];
  researchObjects?: ResearchObject[];
  factChecks?: ResearchFactCheck[];
};

type SavedFile = {
  type: ResearchAssetType;
  localPath: string;
  title: string;
};

type ResearchWebSource = {
  title: string;
  url: string;
  type: string;
  snippet?: string;
  text?: string;
  query?: string;
  domain?: string;
  evidenceTerms?: string[];
};

type ResearchObject = {
  name: string;
  kind: string;
  searchHints: string[];
};

type ResearchFactCheck = {
  claim: string;
  supportLevel: "strong" | "medium" | "weak";
  sources: Array<{ title: string; url: string; type: string }>;
  note?: string;
};

const reportSchemaPrompt = `
请生成一篇中文科技选题研究综述，使用 Markdown。
禁止使用 Markdown 表格。不要输出带竖线的表格。并列信息请用“字段：内容、内容、内容”的形式，或使用普通项目符号列表。
不要使用 Markdown 加粗、斜体、复选框或任务列表。不要输出 **加粗**、__加粗__、[ ]、[x] 这类符号。
不要自行编写“报告生成时间”。报告生成时间由系统自动添加。
报告目标：这不是论文式研究报告，而是给视频创作者看的产品/技术理解稿。读完后，创作者应该知道这个东西是什么、为什么值得讲、怎么讲、需要找哪些画面素材。
重要规则：不要把“待核查问题”作为报告章节。能通过搜索确认的信息，应该先整理成结论再写入报告；如果搜索后仍无法确认，只在对应段落中简短写“来源不足”，不要编造事实或来源链接。
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
13. 是否建议进入素材搜索阶段
14. 来源清单：必须列出信息来源标题和 URL。没有 URL 的来源不要编造链接，只能写“来源不足”。
`;

const videoBriefSchemaPrompt = reportSchemaPrompt && `
请生成一份“视频选题准备稿”，不是论文式研究报告。目标是帮创作者快速看懂这个产品、技术或新闻，判断能不能做视频，以及接下来该找什么画面素材。

写作要求：
- 中文输出，默认 1200-1800 字以内；信息确实复杂时最多不超过 2500 字。
- 不要写成学术综述，不要大段铺历史，不要为了完整而扩写。
- 不要使用 Markdown 表格、加粗星号、斜体、复选框或任务列表。
- 不要自己编写“报告生成时间”，系统会自动添加。
- 只写和做视频决策有关的信息。
- 不要设置“待核查问题”章节；系统应该根据视频内容和已知线索先搜索、整理和交叉确认。
- 不确定的内容不要编造成事实；如果搜索后仍无法确认，只在对应段落里简短标注“来源不足”。
- 必须包含一个标题严格为“素材线索”的独立段落，不能改名为“可作为素材线索的内容”或其他名称。

报告结构必须按下面顺序：
1. 一句话结论：这是什么，值不值得继续看。
2. 这个东西到底是什么：产品/技术/新闻的名称、主体、用途、当前状态。
3. 关键细节：最多 6 条，写清功能、技术点、价格/时间/发布方/使用场景等真正重要的信息。
4. 为什么可能适合做视频：看点、冲突点、新奇点、和普通人的关系。
5. 相关周边：为了讲清它，还需要了解哪些公司、人物、同类产品、旧技术、行业背景或延伸案例。
6. 可拍视频角度：给 3-5 个具体选题方向，每个方向一句话说明。
7. 素材线索：必须写具体可搜索的素材需求和搜索关键词。至少 3 条，优先包含官方 YouTube/发布会/WWDC/演示视频/屏幕录制/真实案例/产品图等；如果能想到英文关键词，必须直接写出，例如 “Apple Personal Voice ALS story”。
8. 来源链接：必须列出信息来源标题和 URL；没有 URL 的来源不要编造链接，只能写“来源不足”。
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

async function createResearchProjectForExploreMaterial(candidateId: string) {
  const candidate = await prisma.exploreCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  return createResearchProject({
    entryType: "EXPLORE_CARD",
    originalUrl: candidate.originalUrl,
    platform: candidate.platform,
    exploreCandidateId: candidate.id,
    title: candidate.chineseTitle ?? candidate.originalTitle,
    summary: candidate.chineseSummary,
  });
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
  const searchQueries = context.searchQueries?.map((query) => `- ${query}`).join("\n");
  const webSources = context.webSources
    ?.slice(0, 8)
    .map((source) => `- ${source.title}: ${source.url}`)
    .join("\n");
  const factChecks = context.factChecks
    ?.slice(0, 8)
    .map((item) => `- ${item.claim}（支撑：${item.supportLevel}，来源数：${item.sources.length}）`)
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
    "## 已尝试搜索线索",
    searchQueries || "- 暂无可用搜索线索。",
    "",
    "## 已找到来源",
    webSources || "- 暂无可用外部来源。",
    "",
    "## 已交叉验证的信息",
    factChecks || "- 暂无足够来源形成交叉验证。",
    "",
    "## 素材线索",
    `需要找的素材：${title} 的官方演示视频、发布会片段、产品或功能屏幕录制、真实使用场景视频。`,
    `英文搜索关键词：${title} official demo、${title} hands on、${title} case study。`,
    "",
    "## 是否建议进入素材搜索阶段",
    "暂不建议。当前自动研究没有获得足够资料，需要补充可分析的视频信息或来源文本后再继续。",
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
  const searchQueries = context.searchQueries?.map((query) => `- ${query}`).join("\n") || "暂无";
  const researchObjects = researchObjectsForPrompt(context.researchObjects ?? []);
  const webSources = researchSourcesForPrompt(context.webSources ?? []);
  const factChecks = factChecksForPrompt(context.factChecks ?? []);

  const prompt = [
    "请优先按下面的“视频选题准备稿”结构输出。忽略上一版报告里论文式、综述式、过长的结构；用户是为了做视频，不是写论文。",
    videoBriefSchemaPrompt,
    "",
    "你是科技内容研究员。用户给你的补充材料可能来自音频转写，可能有错别字、同音字、断句错误、人名品牌名识别错误。请先清洗理解，再提取研究对象，并把已经能确认的信息整理成适合视频创作者理解的报告。",
    "你收到的“自动搜索来源”是系统围绕视频内容搜索到的网页、官网、产品页、媒体报道、论文或开源项目。请优先基于这些来源综合整理，而不是只复述原视频标题。",
    "你还会收到“系统交叉验证结果”。strong/medium 级别的信息可以写成结论；weak 级别只可谨慎引用，必须标注来源不足或表述为线索。",
    "如果多个来源互相支持同一事实，可以直接写成结论；如果来源之间冲突，请在相关段落简短说明差异。",
    "不要编造来源链接。如果缺少资料，只能基于现有材料形成保守结论，并在对应段落简短标注来源不足；不要输出“待核查问题”章节。",
    "报告中的事实性信息必须尽量对应到来源清单中的 URL；来源清单必须保留可点击链接。",
    videoBriefSchemaPrompt,
    "",
    "视频信息提取与内容理解：",
    context.videoUnderstanding ?? buildVideoUnderstanding(context),
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
    "",
    "系统提炼出的搜索词：",
    searchQueries,
    "",
    "研究对象/搜索线索结构化结果：",
    researchObjects,
    "",
    "自动搜索来源整理：",
    webSources,
    "",
    "系统交叉验证结果：",
    factChecks,
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
        {
          role: "user",
          name: "user",
          content: [
            "请优先按“视频选题准备稿”输出。用户是为了做视频，不是写论文；内容要短、清楚、能帮助判断选题。",
            videoBriefSchemaPrompt,
            prompt,
          ].join("\n\n"),
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 3000,
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

function stripUnwantedReportSections(report: string) {
  const blockedHeadings = ["待核查问题", "还需要继续核查的问题", "需要继续核查的问题"];
  const lines = report.split(/\r?\n/);
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const heading = line
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\d+[.、]\s*/, "")
      .replace(/[：:]\s*$/, "")
      .trim();
    const isHeading = /^#{1,6}\s+\S+/.test(line.trim()) || /^\d+[.、]\s*\S{2,30}[：:]?$/.test(line.trim());

    if (isHeading && blockedHeadings.includes(heading)) {
      skipping = true;
      continue;
    }
    if (skipping && isHeading) {
      skipping = false;
    }
    if (!skipping) output.push(line);
  }

  return output.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function normalizeResearchReport(report: string, date = new Date()) {
  const cleaned = stripUnwantedReportSections(sanitizeResearchReport(report));
  return [`报告生成时间：${shanghaiDateText(date)}`, "", cleaned].join("\n").trim();
}

function ensureMaterialCluesSection(report: string, topic?: string | null) {
  if (/(^|\n)#{0,6}\s*(\d+[.、]\s*)?素材线索\s*[:：]?\s*(\n|$)/.test(report)) return report;
  const fallbackTopic = topic?.trim() || "当前主题";
  const section = [
    "## 素材线索",
    `需要找的素材：${fallbackTopic} 的官方演示视频、发布会片段、产品或功能屏幕录制、真实使用场景视频。`,
    `英文搜索关键词：${fallbackTopic} official demo、${fallbackTopic} hands on、${fallbackTopic} case study。`,
  ].join("\n");

  const sourceIndex = report.search(/\n#{1,6}\s*(来源链接|来源清单)/);
  if (sourceIndex >= 0) {
    return `${report.slice(0, sourceIndex).trim()}\n\n${section}\n${report.slice(sourceIndex)}`;
  }
  return `${report.trim()}\n\n${section}`;
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanWebText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function normalizeResearchUrl(url: string) {
  try {
    const parsed = new URL(decodeHtmlEntities(url));
    if (parsed.hostname.includes("duckduckgo.com") && parsed.searchParams.get("uddg")) {
      return parsed.searchParams.get("uddg") ?? url;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return decodeHtmlEntities(url);
  }
}

function researchSourceType(url: string) {
  const domain = sourceDomain(url) ?? "";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(domain)) return "video";
  if (/github\.com/.test(domain)) return "open_source";
  if (/kickstarter\.com|indiegogo\.com|producthunt\.com/.test(domain)) return "product";
  if (/arxiv\.org|nature\.com|science\.org|ieee\.org|acm\.org|mit\.edu|stanford\.edu|cmu\.edu/.test(domain)) return "research";
  if (/reuters\.com|bbc\.com|theverge\.com|wired\.com|techcrunch\.com|cnet\.com/.test(domain)) return "media";
  if (/\.edu|\.org|\.gov/.test(domain)) return "authority";
  return "web";
}

async function fetchTextWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "TechVResearchBot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function sourceTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").slice(0, 120) || parsed.hostname;
  } catch {
    return url.slice(0, 120);
  }
}

function extractPageTitle(html: string, fallbackUrl: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return cleanWebText(title).slice(0, 180);
  return sourceTitleFromUrl(fallbackUrl);
}

function extractPageDescription(html: string) {
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];
  if (meta) return cleanWebText(meta).slice(0, 800);
  return cleanWebText(html).slice(0, 1000);
}

function extractReadablePageText(html: string) {
  const main =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html;

  return cleanWebText(main)
    .replace(/\b(menu|subscribe|newsletter|advertisement|privacy policy|cookie policy)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function tokenizeEvidenceText(text: string) {
  return Array.from(
    new Set(
      text
        .replace(/https?:\/\/\S+/g, " ")
        .match(/[A-Za-z][A-Za-z0-9+-]{2,}|[\u4e00-\u9fa5]{2,8}/g) ?? [],
    ),
  )
    .map((item) => item.toLowerCase())
    .filter((item) => !["this", "that", "with", "from", "have", "more", "about", "使用", "可以", "这个", "一个", "视频"].includes(item))
    .slice(0, 80);
}

function isUsefulResearchUrl(url: string) {
  const domain = sourceDomain(url);
  if (!domain) return false;
  if (/google\.|bing\.com|duckduckgo\.com|youtube\.com\/results/.test(url)) return false;
  if (/\.(jpg|jpeg|png|webp|gif|zip|mp4|mov)(\?|#|$)/i.test(url)) return false;
  return /^https?:\/\//i.test(url);
}

function addUniqueSource(sources: ResearchWebSource[], source: ResearchWebSource) {
  const url = normalizeResearchUrl(source.url);
  if (!isUsefulResearchUrl(url)) return;
  if (sources.some((item) => normalizeResearchUrl(item.url) === url)) return;
  sources.push({
    ...source,
    url,
    domain: source.domain ?? sourceDomain(url),
    type: source.type || researchSourceType(url),
  });
}

function normalizeMaterialUrl(url: string) {
  return url.trim().replace(/[，。；、！？)]$/g, "");
}

function buildVideoUnderstanding(context: ResearchContext) {
  const parts = [
    `标题：${context.project.title ?? context.video?.originalTitle ?? context.candidate?.originalTitle ?? "未知"}`,
    `摘要：${context.project.summary ?? context.video?.chineseSummary ?? context.candidate?.chineseSummary ?? "暂无"}`,
    `描述：${context.video?.description ?? context.candidate?.description ?? "暂无"}`,
    `来源：${context.video?.sourceName ?? context.candidate?.sourceName ?? context.project.entryType}`,
    `原始链接：${context.project.originalUrl}`,
    ...context.supplements.map((item) => `补充材料 ${item.type}：${item.content.slice(0, 1600)}`),
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").slice(0, 9000);
}

function cleanSearchQuery(value?: string | null) {
  return value
    ?.replace(/https?:\/\/\S+/g, " ")
    .replace(/[【】「」《》“”"'()（）[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extractEntityPhrases(text: string) {
  const phrases = new Set<string>();
  const normalized = text.replace(/\s+/g, " ");

  for (const match of normalized.matchAll(/[“「《]([^”」》]{2,60})[”」》]/g)) {
    phrases.add(match[1]);
  }
  for (const match of normalized.matchAll(/\b[A-Z][A-Za-z0-9+-]{1,}(?:\s+[A-Z][A-Za-z0-9+-]{1,}){0,4}\b/g)) {
    phrases.add(match[0]);
  }
  for (const match of normalized.matchAll(/(?:AI|robot|robotics|prosthetic|bionic|wearable|MRI|CNC|printer|drone|exoskeleton|BCI|neural|hardware|Kickstarter|Indiegogo)[^，。；\n]{0,50}/gi)) {
    phrases.add(match[0]);
  }

  return Array.from(phrases)
    .map(cleanSearchQuery)
    .filter((item): item is string => Boolean(item && item.length >= 3))
    .slice(0, 10);
}

function classifyResearchObject(name: string) {
  const value = name.toLowerCase();
  if (/university|institute|lab|clinic|hospital|mit|stanford|cmu|mayo|johns hopkins|harvard|大学|实验室|医院|研究所/.test(value)) {
    return "机构/团队";
  }
  if (/robot|prosthetic|wearable|device|gadget|printer|cnc|drone|mri|camera|hardware|机器人|设备|产品|打印机|假肢|眼镜/.test(value)) {
    return "产品/装置";
  }
  if (/ai|bci|neural|material|battery|sensor|algorithm|interface|智能|脑机|材料|算法|传感器|接口/.test(value)) {
    return "技术";
  }
  if (/kickstarter|indiegogo|launched|announced|发布|众筹|预售|融资/.test(value)) return "事件/发布";
  return "实体/关键词";
}

function buildResearchObjects(context: ResearchContext) {
  const title = cleanSearchQuery(
    context.project.title ?? context.video?.originalTitle ?? context.candidate?.originalTitle,
  );
  const phrases = new Set<string>();
  if (title) phrases.add(title);
  for (const phrase of extractEntityPhrases(buildVideoUnderstanding(context))) phrases.add(phrase);

  return Array.from(phrases)
    .map(cleanSearchQuery)
    .filter((name): name is string => Boolean(name && name.length >= 3))
    .slice(0, 12)
    .map((name) => ({
      name,
      kind: classifyResearchObject(name),
      searchHints: Array.from(
        new Set([name, `${name} official`, `${name} demo`, `${name} how it works`, `${name} research`].map(cleanSearchQuery)),
      ).filter((item): item is string => Boolean(item)),
    }));
}

function buildResearchSearchQueries(context: ResearchContext) {
  const baseTitle = cleanSearchQuery(
    context.project.title ?? context.video?.originalTitle ?? context.candidate?.originalTitle,
  );
  const text = buildVideoUnderstanding(context);
  const entities = extractEntityPhrases(text);
  const objects = context.researchObjects ?? buildResearchObjects(context);
  const queries = new Set<string>();

  if (baseTitle) {
    queries.add(baseTitle);
    queries.add(`${baseTitle} official`);
    queries.add(`${baseTitle} technology`);
    queries.add(`${baseTitle} demo`);
  }

  for (const entity of entities) {
    queries.add(entity);
    queries.add(`${entity} official`);
  }
  for (const object of objects.slice(0, 5)) {
    for (const hint of object.searchHints.slice(0, 3)) queries.add(hint);
  }

  return Array.from(queries)
    .map(cleanSearchQuery)
    .filter((item): item is string => Boolean(item && item.length >= 4))
    .slice(0, 8);
}

async function searchDuckDuckGo(query: string, limit: number) {
  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const html = await fetchTextWithTimeout(url.toString());
  const results: ResearchWebSource[] = [];
  const matches = Array.from(html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const snippets = Array.from(html.matchAll(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>|<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi));

  for (const [index, match] of matches.slice(0, limit).entries()) {
    const resultUrl = normalizeResearchUrl(match[1]);
    addUniqueSource(results, {
      title: cleanWebText(match[2]) || sourceTitleFromUrl(resultUrl),
      url: resultUrl,
      type: researchSourceType(resultUrl),
      snippet: snippets[index] ? cleanWebText(snippets[index][1] ?? snippets[index][2] ?? "") : undefined,
      query,
    });
  }

  return results;
}

async function searchBing(query: string, limit: number) {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", query);
  const html = await fetchTextWithTimeout(url.toString());
  const results: ResearchWebSource[] = [];
  const blocks = Array.from(html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/gi));

  for (const block of blocks.slice(0, limit)) {
    const href = block[0].match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!href) continue;
    const resultUrl = normalizeResearchUrl(href[1]);
    const snippet = block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    addUniqueSource(results, {
      title: cleanWebText(href[2]) || sourceTitleFromUrl(resultUrl),
      url: resultUrl,
      type: researchSourceType(resultUrl),
      snippet: snippet ? cleanWebText(snippet) : undefined,
      query,
    });
  }

  return results;
}

async function webSearch(query: string, limit = 4) {
  try {
    const results = await searchDuckDuckGo(query, limit);
    if (results.length > 0) return results;
  } catch {
    // Try the fallback search provider below.
  }

  try {
    return await searchBing(query, limit);
  } catch {
    return [];
  }
}

async function enrichResearchSource(source: ResearchWebSource) {
  const domain = source.domain ?? sourceDomain(source.url);
  if (/youtube\.com|youtu\.be|vimeo\.com|reddit\.com|news\.ycombinator\.com/.test(domain ?? "")) {
    const baseText = `${source.title} ${source.snippet ?? ""}`;
    return { ...source, evidenceTerms: tokenizeEvidenceText(baseText) };
  }

  try {
    const html = await fetchTextWithTimeout(source.url, {}, 8_000);
    const text = extractReadablePageText(html);
    return {
      ...source,
      title: source.title || extractPageTitle(html, source.url),
      snippet: source.snippet || extractPageDescription(html),
      text,
      evidenceTerms: tokenizeEvidenceText(`${source.title} ${source.snippet ?? ""} ${text}`),
    };
  } catch {
    const baseText = `${source.title} ${source.snippet ?? ""}`;
    return { ...source, evidenceTerms: tokenizeEvidenceText(baseText) };
  }
}

function rankResearchSource(source: ResearchWebSource) {
  const domain = source.domain ?? "";
  let score = 0;
  if (/\.edu|\.gov|mit\.edu|stanford\.edu|cmu\.edu|mayo|johnshopkins|harvard|nature\.com|science\.org|ieee\.org|acm\.org|arxiv\.org/.test(domain)) score += 35;
  if (/github\.com|kickstarter\.com|indiegogo\.com|producthunt\.com|official|docs\./.test(domain)) score += 25;
  if (/reuters\.com|bbc\.com|wired\.com|theverge\.com|techcrunch\.com/.test(domain)) score += 18;
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(domain)) score += 10;
  if (source.snippet && source.snippet.length > 80) score += 8;
  return score;
}

function buildClaimCandidates(context: ResearchContext, objects: ResearchObject[]) {
  const claims = new Set<string>();
  const title = cleanSearchQuery(context.project.title ?? context.video?.originalTitle ?? context.candidate?.originalTitle);
  if (title) claims.add(title);
  for (const object of objects.slice(0, 8)) claims.add(object.name);

  const summary = cleanSearchQuery(context.project.summary ?? context.video?.chineseSummary ?? context.candidate?.chineseSummary);
  if (summary) {
    for (const sentence of summary.split(/[。.!?！？]/).map(cleanSearchQuery)) {
      if (sentence && sentence.length >= 8) claims.add(sentence);
    }
  }

  for (const supplement of context.supplements.slice(0, 4)) {
    for (const sentence of supplement.content.split(/[。.!?！？\n]/).map(cleanSearchQuery)) {
      if (sentence && sentence.length >= 8 && sentence.length <= 120) claims.add(sentence);
      if (claims.size >= 18) break;
    }
  }

  return Array.from(claims).slice(0, 18);
}

function sourceSupportsClaim(source: ResearchWebSource, claim: string) {
  const claimTerms = tokenizeEvidenceText(claim).filter((term) => term.length >= 3);
  if (claimTerms.length === 0) return false;
  const sourceTerms = new Set(source.evidenceTerms ?? tokenizeEvidenceText(`${source.title} ${source.snippet ?? ""} ${source.text ?? ""}`));
  const hits = claimTerms.filter((term) => sourceTerms.has(term));
  const minHits = claimTerms.length >= 6 ? 2 : 1;
  return hits.length >= minHits;
}

function buildFactChecks(context: ResearchContext, sources: ResearchWebSource[], objects: ResearchObject[]) {
  return buildClaimCandidates(context, objects)
    .map((claim) => {
      const matched = sources
        .filter((source) => sourceSupportsClaim(source, claim))
        .slice(0, 5)
        .map((source) => ({
          title: source.title,
          url: source.url,
          type: source.type,
        }));
      const supportLevel: ResearchFactCheck["supportLevel"] =
        matched.length >= 3 ? "strong" : matched.length >= 2 ? "medium" : "weak";
      return {
        claim,
        supportLevel,
        sources: matched,
        note:
          matched.length === 0
            ? "自动搜索来源没有直接命中该信息，只能作为视频原始信息线索。"
            : undefined,
      };
    })
    .filter((item) => item.sources.length > 0 || item.claim.length <= 80)
    .slice(0, 12);
}

async function collectResearchSources(context: ResearchContext, queries: string[]) {
  const sources: ResearchWebSource[] = [];

  for (const source of buildSourceList(context.project, context.supplements)) {
    addUniqueSource(sources, {
      title: source.title,
      url: source.url,
      type: source.type,
      query: "known-source",
    });
  }

  for (const query of queries.slice(0, 6)) {
    const results = await webSearch(query, 4);
    for (const result of results) addUniqueSource(sources, result);
    if (sources.length >= 18) break;
  }

  const enriched = [];
  for (const source of sources.slice(0, 14)) {
    enriched.push(await enrichResearchSource(source));
  }

  return enriched
    .sort((a, b) => rankResearchSource(b) - rankResearchSource(a))
    .slice(0, 12);
}

function researchSourcesForPrompt(sources: ResearchWebSource[]) {
  if (sources.length === 0) return "暂无自动搜索来源。";
  return sources
    .map((source, index) => {
      const snippet = source.snippet ? `\n摘要：${source.snippet.slice(0, 700)}` : "";
      const evidence = source.text ? `\n正文证据摘录：${source.text.slice(0, 900)}` : "";
      return `${index + 1}. ${source.title}\nURL：${source.url}\n类型：${source.type}${source.query ? `\n搜索词：${source.query}` : ""}${snippet}${evidence}`;
    })
    .join("\n\n");
}

function researchObjectsForPrompt(objects: ResearchObject[]) {
  if (objects.length === 0) return "暂无结构化研究对象。";
  return objects
    .map((object, index) => {
      const hints = object.searchHints.slice(0, 4).join(" / ");
      return `${index + 1}. ${object.name}\n类型：${object.kind}\n搜索线索：${hints}`;
    })
    .join("\n\n");
}

function factChecksForPrompt(items: ResearchFactCheck[]) {
  if (items.length === 0) return "暂无足够来源形成交叉验证。";
  return items
    .map((item, index) => {
      const sources = item.sources
        .map((source) => `${source.title} (${source.type}) ${source.url}`)
        .join("\n  - ");
      return `${index + 1}. ${item.claim}\n支撑强度：${item.supportLevel}${item.note ? `\n备注：${item.note}` : ""}\n来源：\n  - ${sources || "来源不足"}`;
    })
    .join("\n\n");
}

function materialTypeFromUrl(url: string, title = ""): ResearchMaterialType {
  const value = `${url} ${title}`.toLowerCase();
  if (isVideoMaterialUrl(url)) return "VIDEO";
  if (isDirectImageUrl(url)) return "IMAGE";
  if (/images|image|photo|gallery|unsplash|flickr|jpg|jpeg|png|webp/.test(value)) return "IMAGE";
  if (/github\.com|docs\.|developer\.|documentation|whitepaper|paper|arxiv|pdf/.test(value)) return "OFFICIAL_DOC";
  if (/product|store|shop|kickstarter|indiegogo|app\.|apps\.apple|play\.google/.test(value)) return "PRODUCT_PAGE";
  if (/twitter\.com|x\.com|instagram\.com|xiaohongshu\.com|weibo\.com|threads\.net/.test(value)) return "SOCIAL_POST";
  if (/dataset|data|kaggle/.test(value)) return "DATASET";
  if (/search|results|bing\.com|google\.com/.test(value)) return "SEARCH_QUERY";
  return "ARTICLE";
}

function isDirectImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(url);
}

function isVideoMaterialUrl(url: string) {
  return /youtube\.com\/watch\?|youtu\.be\/[A-Za-z0-9_-]+|bilibili\.com\/video\/[A-Za-z0-9_-]+|vimeo\.com\/\d+|\.mp4(\?|#|$)|\.mov(\?|#|$)|\.webm(\?|#|$)/i.test(
    url,
  );
}

function isMaterialMediaUrl(url: string) {
  return isVideoMaterialUrl(url) || isDirectImageUrl(url);
}

function materialUsage(type: ResearchMaterialType) {
  const usage: Record<ResearchMaterialType, string> = {
    VIDEO: "可用于核查原视频、寻找画面片段、确认演示细节。",
    IMAGE: "可用于找产品图、界面截图、发布会画面或 B-roll 参考。",
    ARTICLE: "可用于事实核查、背景信息和口播引用依据。",
    PRODUCT_PAGE: "可用于确认产品功能、参数、价格、发布时间和官方表述。",
    OFFICIAL_DOC: "可用于确认技术细节、官方定义、论文或开发者说明。",
    SOCIAL_POST: "可用于观察用户反馈、争议点和传播语境。",
    DATASET: "可用于补充数据支撑或趋势判断。",
    SEARCH_QUERY: "搜索入口，用于继续人工筛选可用图片、视频和权威来源。",
    OTHER: "待人工判断用途。",
  };
  return usage[type];
}

function materialCopyrightRisk(type: ResearchMaterialType) {
  if (type === "OFFICIAL_DOC" || type === "ARTICLE" || type === "PRODUCT_PAGE") {
    return "可作为信息来源引用；页面图片、视频或大段文字仍需单独核查授权。";
  }
  if (type === "SEARCH_QUERY") {
    return "搜索结果仅作为线索；实际使用前必须逐条核查版权、授权和平台规则。";
  }
  return "高风险素材候选；不要直接搬运，使用前需确认版权、授权、署名和平台规则。";
}

async function videoMaterialMetadata(url: string, fallbackTitle: string) {
  try {
    const video = await extractVideo(url);
    let chineseTitle = video.originalTitle;
    try {
      const ai = await analyzeVideoWithMinimax({
        title: video.originalTitle,
        description: video.description,
        sourceName: video.sourceName,
        platform: video.platform,
        publishedAt: video.publishedAt,
        likeCount: video.likeCount,
      });
      chineseTitle = ai.chineseTitle;
    } catch {
      // Keep original title when title translation is unavailable.
    }

    return {
      title: video.originalTitle,
      chineseTitle,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
    };
  } catch {
    return {
      title: fallbackTitle,
      chineseTitle: fallbackTitle,
      thumbnailUrl: undefined,
      publishedAt: undefined,
    };
  }
}

function sourceListFromJson(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as { title?: unknown; url?: unknown; type?: unknown };
      if (typeof source.url !== "string") return null;
      return {
        title: typeof source.title === "string" ? source.title : source.url,
        url: source.url,
        type: typeof source.type === "string" ? source.type : "source",
      };
    })
    .filter(Boolean) as Array<{ title: string; url: string; type: string }>;
}

function isSearchResultPage(url: string) {
  return /youtube\.com\/results|google\.com\/search|bing\.com\/images\/search|bing\.com\/search/i.test(url);
}

function firstReportHeading(reportMarkdown?: string) {
  const lines = reportMarkdown?.split(/\r?\n/) ?? [];
  for (const line of lines) {
    const text = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/^视频选题准备稿\s*$/, "")
      .trim();
    if (!text || /^报告生成时间/.test(text) || text.length < 6) continue;
    return text.slice(0, 80);
  }
  return undefined;
}

function reportSectionText(reportMarkdown: string | undefined, sectionNames: string[]) {
  if (!reportMarkdown) return undefined;
  const lines = reportMarkdown.split(/\r?\n/);
  const start = lines.findIndex((line) => sectionNames.some((name) => line.includes(name)));
  if (start < 0) return undefined;
  const content: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,6}\s+/.test(line) && content.length > 0) break;
    const text = line.replace(/^[-*]\s*/, "").trim();
    if (text) content.push(text);
    if (content.join(" ").length > 500) break;
  }
  return content.join(" ").slice(0, 500) || undefined;
}

function isInstructionLikeTheme(value?: string | null) {
  if (!value) return false;
  return /^(加入|增加|补充|调整|改成|按照|按|只找|不要|搜索|重新|继续|扩展|收窄)/.test(value.trim());
}

function cleanSearchText(value?: string | null) {
  return value?.replace(/\s+/g, " ").replace(/[：:，。；;、]/g, " ").trim();
}

function materialClueQueries(materialClues: string | undefined, topic: string) {
  if (!materialClues) return [];
  const normalized = materialClues.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const quoted = Array.from(normalized.matchAll(/"([^"]{4,80})"/g)).map((match) => match[1]);
  const phrases = normalized
    .replace(/需要找的素材[:：]?/g, "")
    .split(/[，。；;、\n]/)
    .map((item) => cleanSearchText(item))
    .filter((item): item is string => Boolean(item && item.length >= 4))
    .filter((item) => !/^(英文搜索关键词用|关键词用|搜索关键词|可能是|需要找的素材)$/.test(item));

  const focused = [...quoted, ...phrases]
    .map((item) => item.replace(/^Apple官方YouTube频道的?/, "Apple official YouTube "))
    .map((item) => item.replace(/官方介绍视频/g, "official demo"))
    .map((item) => item.replace(/演示视频|演示片段/g, "demo video"))
    .map((item) => item.replace(/使用场景视频/g, "use case video"))
    .map((item) => item.replace(/屏幕录制演示/g, "screen recording demo"))
    .map((item) => cleanSearchText(item))
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(focused.map((item) => (/[A-Za-z]/.test(item) ? item : `${topic} ${item}`)))).slice(0, 5);
}

function youtubeMaterialQueries(project: ResearchProject, instruction?: string, reportMarkdown?: string, theme?: string | null) {
  const heading = firstReportHeading(reportMarkdown);
  const base =
    heading ??
    project.title ??
    (!isInstructionLikeTheme(theme) ? theme : undefined) ??
    project.researchTarget ??
    project.oneLineConclusion ??
    project.summary ??
    "科技产品";
  const topic = cleanSearchText(base)?.slice(0, 80) || "科技产品";
  const materialClues = reportSectionText(reportMarkdown, ["素材线索"]);

  const queries = materialClueQueries(materialClues, topic);
  const extra = instruction?.replace(/\s+/g, " ").trim();
  if (extra) {
    queries.unshift(`${topic} ${extra}`);
    queries.push(extra);
  }
  if (queries.length === 0) {
    queries.push(`${topic} official demo`, `${topic} hands on`);
  }
  return Array.from(new Set(queries)).slice(0, 5);
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

function mergeResearchSources(
  baseSources: Array<{ title: string; url: string; type: string }>,
  webSources: ResearchWebSource[],
) {
  const merged: ResearchWebSource[] = baseSources.map((source) => ({ ...source }));
  for (const source of webSources) {
    addUniqueSource(merged, {
      title: source.title,
      url: source.url,
      type: source.type,
      snippet: source.snippet,
      query: source.query,
      domain: source.domain,
    });
  }
  return merged.map((source) => ({
    title: source.title,
    url: source.url,
    type: source.type,
    snippet: source.snippet,
    query: source.query,
    domain: source.domain,
  }));
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
  const latest = await prisma.researchReportVersion.findFirst({
    where: { projectId: input.projectId },
    orderBy: { versionNumber: "desc" },
  });
  const isRapidSameInstruction =
    input.userInstruction &&
    latest?.userInstruction === input.userInstruction &&
    Date.now() - latest.createdAt.getTime() < 2 * 60 * 1000;

  await prisma.researchReportVersion.updateMany({
    where: { projectId: input.projectId, isCurrent: true },
    data: { isCurrent: false },
  });

  if (isRapidSameInstruction && latest) {
    return prisma.researchReportVersion.update({
      where: { id: latest.id },
      data: {
        theme: input.theme ?? latest.theme,
        reportMarkdown: input.reportMarkdown,
        sourceList: input.sourceList,
        isCurrent: true,
      },
    });
  }

  const versionNumber = await nextReportVersionNumber(input.projectId);

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
    "## 素材线索",
    `需要找的素材：${project.title ?? project.researchTarget ?? "当前主题"} 的官方演示视频、发布会片段、产品或功能屏幕录制、真实使用场景视频。`,
    `英文搜索关键词：${project.title ?? project.researchTarget ?? "current topic"} official demo、${project.title ?? project.researchTarget ?? "current topic"} hands on、${project.title ?? project.researchTarget ?? "current topic"} case study。`,
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
    "不要编造来源链接。报告最后必须列出来源链接；没有 URL 的事实只能简短标注来源不足，不要设置“待核查问题”章节。",
    "",
    "新版报告必须包含：",
    "1. 本轮调整目标",
    "2. 新确认或候选主题",
    "3. 新增资料方向",
    "4. 和上一版相比改变了什么",
    "5. 详细综述",
    "6. 适合做视频的角度",
    "7. 素材线索",
    "8. 是否建议确认主题并进入素材搜索",
    "9. 来源链接",
    "",
    "注意：第 7 节标题必须严格写成“素材线索”。这一节至少写 3 条具体可搜索的素材需求或英文关键词，用于下一阶段自动搜索视频/图片素材。",
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
        {
          role: "user",
          name: "user",
          content: [
            "请优先按“视频选题准备稿”输出。用户是为了做视频，不是写论文；新版报告要更短、更清楚、更便于判断选题。",
            videoBriefSchemaPrompt,
            prompt,
          ].join("\n\n"),
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 3000,
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
  let host = "research";
  try {
    host = new URL(project.originalUrl).hostname;
  } catch {
    // Use fallback below.
  }

  const raw = project.title ?? project.researchTarget ?? host;
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 24);
  return cleaned || "research";
}

async function ensureProjectFolders(project: ResearchProject) {
  if (project.projectFolderPath) {
    await mkdir(project.projectFolderPath, { recursive: true });
    return project.projectFolderPath;
  }

  const previousProjectCount = await prisma.researchProject.count({
    where: { createdAt: { lte: project.createdAt } },
  });
  const folder = path.join(
    MATERIAL_ROOT,
    `${String(previousProjectCount).padStart(3, "0")}_${safeProjectName(project)}`,
  );
  await mkdir(folder, { recursive: true });

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

function shouldTrySubtitleExtraction(platform?: Platform | null) {
  return platform === "YOUTUBE" || platform === "WEB" || platform === "INSTAGRAM" || platform === "TIKTOK";
}

async function tryPublicSubtitleExtraction(project: ResearchProject) {
  const existingSubtitle = await prisma.researchSupplement.count({
    where: { projectId: project.id, type: "SUBTITLE" },
  });
  if (existingSubtitle > 0) return;

  const projectFolder = await ensureProjectFolders(project);
  const outputTemplate = path.join(projectFolder, "000_subtitle.%(ext)s");

  try {
    await downloadResearchSubtitles(project.originalUrl, outputTemplate);
    const files = await listFiles(projectFolder);
    const subtitleFiles = files.filter((file) => assetTypeFromFile(file) === "SUBTITLE");
    if (subtitleFiles.length === 0) return;

    await saveAssets(
      project.id,
      subtitleFiles.map((file) => ({
        type: "SUBTITLE",
        localPath: file,
        title: path.basename(file),
      })),
      project.originalUrl,
    );
    await addSubtitleSupplements(project.id, subtitleFiles);
    await prisma.researchProject.update({
      where: { id: project.id },
      data: { projectFolderPath: projectFolder },
    });
  } catch {
    // Subtitle extraction is best-effort. Research can continue with metadata and web sources.
  }
}

async function extractAudioAndKeyframe(projectId: string, projectFolder: string, files: string[], sourceUrl: string) {
  const videoFile = files.find((file) => assetTypeFromFile(file) === "VIDEO");
  if (!videoFile) return;

  const saved: SavedFile[] = [];
  const audioPath = path.join(projectFolder, "002_extracted_audio.m4a");
  const keyframePath = path.join(projectFolder, "003_keyframe.jpg");

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
  const outputTemplate = path.join(projectFolder, "001_source.%(ext)s");

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

function safeFileSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 48) || "material";
}

async function saveMaterialLinkFile(input: {
  projectId: string;
  folder: string;
  title: string;
  sourceUrl: string;
  notes?: string | null;
}) {
  const filePath = path.join(input.folder, `${safeFileSegment(input.title)}_${input.projectId.slice(0, 6)}.txt`);
  const content = [
    `标题：${input.title}`,
    `链接：${input.sourceUrl}`,
    input.notes ? `备注：${input.notes}` : undefined,
    "",
    "说明：该条素材不是可直接下载的视频直链，系统先保存为链接归档。实际用于视频前仍需人工打开来源并核查版权、授权和可用性。",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(filePath, content, "utf8");
  await saveAssets(input.projectId, [{ type: "OTHER", localPath: filePath, title: input.title }], input.sourceUrl);
  return filePath;
}

async function downloadImageMaterial(input: {
  projectId: string;
  folder: string;
  title: string;
  sourceUrl: string;
}) {
  const response = await fetch(input.sourceUrl);
  if (!response.ok) throw new Error(`图片下载失败：${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error("链接不是可直接下载的图片文件");

  const extFromType = contentType.split("/").at(1)?.split(";").at(0) ?? "jpg";
  const filePath = path.join(input.folder, `${safeFileSegment(input.title)}.${extFromType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);
  await saveAssets(input.projectId, [{ type: "IMAGE", localPath: filePath, title: input.title }], input.sourceUrl);
  return filePath;
}

export async function downloadResearchMaterial(materialId: string) {
  const material = await prisma.researchMaterial.findUniqueOrThrow({
    where: { id: materialId },
    include: { project: true },
  });

  if (material.status === "REJECTED") {
    throw new Error("这条素材已标记为不用，不能下载。");
  }
  if (material.status === "DOWNLOADING") {
    return material;
  }

  await prisma.researchMaterial.update({
    where: { id: materialId },
    data: { status: "DOWNLOADING", notes: material.notes },
  });

  const projectFolder = await ensureProjectFolders(material.project);

  try {
    if (material.type === "VIDEO") {
      const outputName = `${safeFileSegment(material.chineseTitle ?? material.title)}.%(ext)s`;
      await downloadResearchMedia(material.sourceUrl, path.join(projectFolder, outputName));
      const files = await listFiles(projectFolder);
      await saveAssets(
        material.projectId,
        files.map((file) => ({
          type: assetTypeFromFile(file),
          localPath: file,
          title: path.basename(file),
        })),
        material.sourceUrl,
      );
    } else if (material.type === "IMAGE") {
      await downloadImageMaterial({
        projectId: material.projectId,
        folder: projectFolder,
        title: material.title,
        sourceUrl: material.sourceUrl,
      });
    } else {
      await saveMaterialLinkFile({
        projectId: material.projectId,
        folder: projectFolder,
        title: material.title,
        sourceUrl: material.sourceUrl,
        notes: material.notes,
      });
    }

    await prisma.researchProject.update({
      where: { id: material.projectId },
      data: {
        projectFolderPath: projectFolder,
        materialStatus: "PARTIAL",
        recommendation: "已下载或归档部分素材，请从自动解析素材入口查看本地文件详情。",
      },
    });

    return prisma.researchMaterial.update({
      where: { id: materialId },
      data: {
        status: "DOWNLOADED",
        notes: material.notes ? `${material.notes}\n已下载/归档到：${projectFolder}` : `已下载/归档到：${projectFolder}`,
      },
    });
  } catch (error) {
    return prisma.researchMaterial.update({
      where: { id: materialId },
      data: {
        status: "FAILED",
        notes:
          error instanceof Error
            ? `${material.notes ?? ""}\n下载失败：${error.message.slice(0, 500)}`.trim()
            : `${material.notes ?? ""}\n下载失败：未知错误`.trim(),
      },
    });
  }
}

export async function downloadResearchMaterials(projectId: string) {
  const materials = await prisma.researchMaterial.findMany({
    where: {
      projectId,
      status: { notIn: ["REJECTED", "DOWNLOADED", "DOWNLOADING"] },
      type: { in: ["VIDEO", "IMAGE"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  let downloaded = 0;
  let failed = 0;

  for (const material of materials) {
    const result = await downloadResearchMaterial(material.id);
    if (result.status === "DOWNLOADED") downloaded += 1;
    if (result.status === "FAILED") failed += 1;
  }

  return {
    total: materials.length,
    downloaded,
    failed,
  };
}

type PoolDownloadResult = {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
};

async function downloadOriginalMediaForProject(project: ResearchProject) {
  const existingAssets = await prisma.researchAsset.count({
    where: {
      projectId: project.id,
      sourceUrl: project.originalUrl,
      status: "SAVED",
      type: { in: ["VIDEO", "AUDIO", "IMAGE", "SUBTITLE", "KEYFRAME"] },
    },
  });

  if (existingAssets > 0) return "skipped" as const;

  const projectFolder = await ensureProjectFolders(project);
  const outputName = `${safeFileSegment(project.title ?? project.researchTarget ?? "source")}.%(ext)s`;

  await prisma.researchProject.update({
    where: { id: project.id },
    data: { materialStatus: "DOWNLOADING", projectFolderPath: projectFolder, errorMessage: null },
  });

  try {
    await downloadResearchMedia(project.originalUrl, path.join(projectFolder, outputName));
    const files = await listFiles(projectFolder);
    await saveAssets(
      project.id,
      files.map((file) => ({
        type: assetTypeFromFile(file),
        localPath: file,
        title: path.basename(file),
      })),
      project.originalUrl,
    );
    await prisma.researchProject.update({
      where: { id: project.id },
      data: {
        materialStatus: "PARTIAL",
        projectFolderPath: projectFolder,
        recommendation: "素材池一键下载已保存原始视频，请到已保存素材详情页查看本地文件。",
      },
    });
    return "downloaded" as const;
  } catch (error) {
    await prisma.researchAsset.create({
      data: {
        projectId: project.id,
        type: "VIDEO",
        status: "FAILED",
        sourceUrl: project.originalUrl,
        notes:
          error instanceof Error
            ? `素材池一键下载失败：${error.message.slice(0, 500)}`
            : "素材池一键下载失败：未知错误",
      },
    });
    await prisma.researchProject.update({
      where: { id: project.id },
      data: {
        materialStatus: "FAILED",
        projectFolderPath: projectFolder,
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "素材池一键下载失败",
      },
    });
    return "failed" as const;
  }
}

function emptyPoolResult(): PoolDownloadResult {
  return { total: 0, downloaded: 0, skipped: 0, failed: 0 };
}

function addPoolResult(result: PoolDownloadResult, status: "downloaded" | "skipped" | "failed") {
  result.total += 1;
  result[status] += 1;
}

export async function downloadRadarMaterialPool() {
  const result = emptyPoolResult();
  const videos = await prisma.videoItem.findMany({
    where: { decisionStatus: "MATERIAL" },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  for (const video of videos) {
    const project = await createResearchProject({
      entryType: "RADAR_CARD",
      originalUrl: video.originalUrl,
      platform: video.platform,
      sourceVideoId: video.id,
      title: video.chineseTitle ?? video.originalTitle,
      summary: video.chineseSummary,
    });
    addPoolResult(result, await downloadOriginalMediaForProject(project));
  }

  return result;
}

export async function downloadExploreMaterialPool() {
  const result = emptyPoolResult();
  const candidates = await prisma.exploreCandidate.findMany({
    where: { status: "MATERIAL" },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  for (const candidate of candidates) {
    const project = await createResearchProjectForExploreMaterial(candidate.id);
    addPoolResult(result, await downloadOriginalMediaForProject(project));
  }

  return result;
}

export async function downloadUnifiedMaterialPool() {
  const result = emptyPoolResult();
  const radarResult = await downloadRadarMaterialPool();
  const exploreResult = await downloadExploreMaterialPool();

  result.total = radarResult.total + exploreResult.total;
  result.downloaded = radarResult.downloaded + exploreResult.downloaded;
  result.skipped = radarResult.skipped + exploreResult.skipped;
  result.failed = radarResult.failed + exploreResult.failed;

  return result;
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

  if (shouldTrySubtitleExtraction(platform)) {
    await tryPublicSubtitleExtraction({ ...project, platform, title, summary });
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

  const baseProject = { ...project, platform, title, summary };
  const baseSupplements = supplements.map((item) => ({ type: item.type, content: item.content }));
  const baseContext: ResearchContext = {
    project: baseProject,
    video: project.sourceVideo,
    candidate: project.exploreCandidate,
    supplements: baseSupplements,
  };
  const videoUnderstanding = buildVideoUnderstanding(baseContext);
  const researchObjects = buildResearchObjects({ ...baseContext, videoUnderstanding });
  const searchQueries = buildResearchSearchQueries({ ...baseContext, videoUnderstanding, researchObjects });

  await prisma.researchProject.update({
    where: { id: projectId },
    data: { platform, title, summary, status: "SEARCHING_TEXT" },
  });

  const webSources = await collectResearchSources(
    { ...baseContext, videoUnderstanding, researchObjects, searchQueries },
    searchQueries,
  );
  const factChecks = buildFactChecks(
    { ...baseContext, videoUnderstanding, researchObjects, searchQueries, webSources },
    webSources,
    researchObjects,
  );

  await prisma.researchProject.update({
    where: { id: projectId },
    data: { status },
  });

  const context: ResearchContext = {
    project: { ...project, platform, title, summary },
    video: project.sourceVideo,
    candidate: project.exploreCandidate,
    supplements: baseSupplements,
    videoUnderstanding,
    researchObjects,
    searchQueries,
    webSources,
    factChecks,
  };

  let report: string;
  try {
    report = await callResearchModel(context);
  } catch (error) {
    report = fallbackReport(context, error instanceof Error ? error.message : "未知错误");
  }
  report = normalizeResearchReport(report);
  report = ensureMaterialCluesSection(report, title ?? project.researchTarget ?? project.oneLineConclusion);
  const finalSourceList = mergeResearchSources(buildSourceList(baseProject, supplements), webSources);

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
  report = ensureMaterialCluesSection(report, project.title ?? project.researchTarget ?? project.oneLineConclusion);
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

export async function searchResearchMaterials(
  projectId: string,
  options: { instruction?: string; mode?: "append" | "replace" } = {},
) {
  const project = await prisma.researchProject.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      reportVersions: {
        where: { isFinal: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
  const mode = options.mode ?? "append";
  const instruction = options.instruction?.trim();
  const finalReportVersion = project.reportVersions[0];
  if (!finalReportVersion) {
    throw new Error("请先在报告版本里设置最终主题，再搜索素材。");
  }
  const activeReportMarkdown = finalReportVersion.reportMarkdown;
  const activeSourceList = finalReportVersion.sourceList ?? project.sourceList;
  const activeTheme = finalReportVersion.theme ?? project.researchTarget;

  await prisma.researchMaterial.deleteMany({
    where: {
      projectId,
      OR: [
        { type: "SEARCH_QUERY" },
        { sourceUrl: { contains: "youtube.com/results" } },
        { sourceUrl: { contains: "google.com/search" } },
        { sourceUrl: { contains: "bing.com/images/search" } },
        { sourceUrl: { contains: "bing.com/search" } },
      ],
    },
  });

  if (mode === "replace") {
    await prisma.researchMaterial.deleteMany({
      where: {
        projectId,
        status: { notIn: ["REJECTED", "DOWNLOADED", "DOWNLOADING"] },
        type: { in: ["VIDEO", "IMAGE"] },
      },
    });
  }

  const candidates = new Map<
    string,
    {
      title: string;
      chineseTitle?: string;
      sourceUrl: string;
      type: ResearchMaterialType;
      thumbnailUrl?: string;
      publishedAt?: Date;
      notes?: string;
    }
  >();

  async function addCandidate(input: {
    title: string;
    chineseTitle?: string;
    sourceUrl: string;
    type?: ResearchMaterialType;
    thumbnailUrl?: string;
    publishedAt?: Date;
    notes?: string;
  }) {
    const sourceUrl = normalizeMaterialUrl(input.sourceUrl);
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return;
    if (isSearchResultPage(sourceUrl)) return;
    const type = input.type ?? materialTypeFromUrl(sourceUrl, input.title);
    if (type !== "VIDEO" && type !== "IMAGE") return;

    let title = input.title.trim().slice(0, 180) || sourceUrl;
    let chineseTitle = input.chineseTitle?.trim().slice(0, 180);
    let thumbnailUrl = input.thumbnailUrl;
    let publishedAt = input.publishedAt;

    if (type === "VIDEO" && (!chineseTitle || !thumbnailUrl || !publishedAt)) {
      const metadata = await videoMaterialMetadata(sourceUrl, title);
      title = metadata.title.slice(0, 180);
      chineseTitle = metadata.chineseTitle.slice(0, 180);
      thumbnailUrl = metadata.thumbnailUrl;
      publishedAt = metadata.publishedAt;
    }

    if (type === "IMAGE" && !thumbnailUrl && isDirectImageUrl(sourceUrl)) {
      thumbnailUrl = sourceUrl;
    }

    candidates.set(sourceUrl, {
      title,
      chineseTitle,
      sourceUrl,
      type,
      thumbnailUrl,
      publishedAt,
      notes: input.notes,
    });
  }

  if (isMaterialMediaUrl(project.originalUrl)) {
    await addCandidate({
      title: project.title ? `原始来源：${project.title}` : "原始来源",
      sourceUrl: project.originalUrl,
      notes: "研究项目的原始素材链接。",
    });
  }

  for (const source of sourceListFromJson(activeSourceList)) {
    if (isMaterialMediaUrl(source.url)) {
      await addCandidate({
        title: source.title,
        sourceUrl: source.url,
        notes: `研究来源中识别出的素材链接：${source.type}`,
      });
    }
  }

  for (const url of extractUrls(activeReportMarkdown)) {
    if (isMaterialMediaUrl(url)) {
      await addCandidate({
        title: `报告中提到的素材链接：${url}`,
        sourceUrl: url,
        notes: "从当前研究报告正文中识别出的素材链接。",
      });
    }
  }

  let youtubeSearchError: string | undefined;
  for (const query of youtubeMaterialQueries(project, instruction, activeReportMarkdown, activeTheme)) {
    try {
      const videos = await searchYouTubeVideos(query, 5);
      for (const video of videos) {
        let chineseTitle = video.originalTitle;
        try {
          const ai = await analyzeVideoWithMinimax({
            title: video.originalTitle,
            description: video.description,
            sourceName: video.sourceName,
            platform: video.platform,
            publishedAt: video.publishedAt,
            likeCount: video.likeCount,
          });
          chineseTitle = ai.chineseTitle;
        } catch {
          // Keep original title when translation is unavailable.
        }

        await addCandidate({
          title: video.originalTitle,
          chineseTitle,
          sourceUrl: video.originalUrl,
          type: "VIDEO",
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          notes: instruction
            ? `YouTube 自动搜索结果：${query}。用户搜索指令：${instruction}。来源频道：${video.sourceName}`
            : `YouTube 自动搜索结果：${query}。来源频道：${video.sourceName}`,
        });
      }
    } catch (error) {
      youtubeSearchError = error instanceof Error ? error.message : "YouTube 搜索失败";
    }
  }

  if (mode === "replace") {
    await prisma.researchMaterial.deleteMany({
      where: {
        projectId,
        status: { notIn: ["REJECTED", "DOWNLOADED", "DOWNLOADING"] },
        type: { in: ["VIDEO", "IMAGE"] },
        sourceUrl: { notIn: Array.from(candidates.keys()) },
      },
    });
  }

  let createdCount = 0;
  for (const candidate of candidates.values()) {
    const result = await prisma.researchMaterial.upsert({
      where: {
        projectId_sourceUrl: {
          projectId,
          sourceUrl: candidate.sourceUrl,
        },
      },
      create: {
        projectId,
        type: candidate.type,
        title: candidate.title,
        chineseTitle: candidate.chineseTitle,
        sourceUrl: candidate.sourceUrl,
        thumbnailUrl: candidate.thumbnailUrl,
        publishedAt: candidate.publishedAt,
        usage: materialUsage(candidate.type),
        copyrightRisk: materialCopyrightRisk(candidate.type),
        notes: candidate.notes,
      },
      update: {
        type: candidate.type,
        title: candidate.title,
        chineseTitle: candidate.chineseTitle,
        thumbnailUrl: candidate.thumbnailUrl,
        publishedAt: candidate.publishedAt,
        usage: materialUsage(candidate.type),
        copyrightRisk: materialCopyrightRisk(candidate.type),
        notes: candidate.notes,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) createdCount += 1;
  }

  await prisma.researchProject.update({
    where: { id: projectId },
    data: {
      materialStatus: candidates.size > 0 ? "PARTIAL" : "FAILED",
      recommendation:
        candidates.size > 0
          ? youtubeSearchError
            ? `已生成第一版素材候选池，但 YouTube 自动搜索部分失败：${youtubeSearchError.slice(0, 200)}。请逐条核查版权、用途和可用性。`
            : "已生成第一版素材候选池，请逐条核查版权、用途和可用性。"
          : "暂未生成素材候选，请补充更多来源链接或报告内容后重试。",
    },
  });

  return {
    total: candidates.size,
    created: createdCount,
    mode,
    reportVersion: finalReportVersion.versionNumber,
    youtubeSearchError,
  };
}
