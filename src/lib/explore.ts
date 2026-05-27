import type { ExploreRule, ExploreRuleType, Platform, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { exploreCandidateQualityWhere, exploreFreshnessCutoff, lowViewExploreCutoff } from "./explore-config";
import { analyzeVideoWithMinimax } from "./minimax";
import type { ExtractedVideo } from "./types";
import { searchYouTubeVideos } from "./yt-dlp";

const SEARCH_LIMIT_PER_RULE = 4;
const MAX_CANDIDATES_PER_RUN = 100;

type ExploreSource =
  | "youtube"
  | "vimeo"
  | "kickstarter"
  | "indiegogo"
  | "producthunt"
  | "reddit"
  | "hackernews"
  | "github"
  | "ted"
  | "authority-youtube";

const legacyDefaultKeywords = [
  "portable MRI",
  "medical robot",
  "brain computer interface",
  "robotic surgery",
  "AI wearable",
  "lab tour neurotechnology",
  "DIY robot arm",
  "Kickstarter AI pet",
  "TED medical technology",
  "micro robot medical",
];

const defaultRules: Array<{
  keyword: string;
  type: ExploreRuleType;
  category: string;
  weight: number;
  notes?: string;
}> = [
  { keyword: "AI pet new demo", type: "SEARCH", category: "AI实体设备", weight: 5, notes: "source:youtube" },
  { keyword: "AI companion robot prototype", type: "SEARCH", category: "AI实体设备", weight: 5, notes: "source:youtube" },
  { keyword: "desktop companion robot emotional robot demo", type: "SEARCH", category: "AI实体设备", weight: 4, notes: "source:youtube" },
  { keyword: "humanoid robot home robot demo", type: "SEARCH", category: "机器人/仿生", weight: 5, notes: "source:youtube" },
  { keyword: "soft robot bionic robot lab demo", type: "SEARCH", category: "机器人/仿生", weight: 5, notes: "source:youtube" },
  { keyword: "robot furniture robot lamp prototype", type: "SEARCH", category: "机器人/仿生", weight: 4, notes: "source:youtube" },
  { keyword: "DIY robot arm open source build guide", type: "SEARCH", category: "极客DIY", weight: 5, notes: "source:youtube" },
  { keyword: "I built homemade robot over engineered", type: "SEARCH", category: "极客DIY", weight: 4, notes: "source:youtube" },
  { keyword: "Arduino Raspberry Pi maker project full tutorial", type: "SEARCH", category: "极客DIY", weight: 4, notes: "source:youtube" },
  { keyword: "AI pet Kickstarter demo", type: "SEARCH", category: "众筹爆品", weight: 5, notes: "source:kickstarter" },
  { keyword: "robot Kickstarter prototype", type: "SEARCH", category: "众筹爆品", weight: 5, notes: "source:kickstarter" },
  { keyword: "desktop CNC Kickstarter raised over", type: "SEARCH", category: "桌面工厂", weight: 5, notes: "source:kickstarter" },
  { keyword: "UV printer Indiegogo demo", type: "SEARCH", category: "桌面工厂", weight: 4, notes: "source:indiegogo" },
  { keyword: "maker tool Indiegogo crowdfunding", type: "SEARCH", category: "众筹爆品", weight: 4, notes: "source:indiegogo" },
  { keyword: "new AI hardware Product Hunt", type: "SEARCH", category: "新奇产品", weight: 4, notes: "source:producthunt" },
  { keyword: "new gadget Product Hunt smart device", type: "SEARCH", category: "新奇产品", weight: 4, notes: "source:producthunt" },
  { keyword: "portable MRI breakthrough demo", type: "SEARCH", category: "医疗辅助科技", weight: 5, notes: "source:youtube" },
  { keyword: "assistive technology bionic prosthetic demo", type: "SEARCH", category: "医疗辅助科技", weight: 5, notes: "source:youtube" },
  { keyword: "surgical robot medical robot lab demo", type: "SEARCH", category: "医疗辅助科技", weight: 4, notes: "source:youtube" },
  { keyword: "brain computer interface thought to text demo", type: "SEARCH", category: "脑机接口", weight: 5, notes: "source:youtube" },
  { keyword: "bionic eye artificial vision neural interface", type: "SEARCH", category: "脑机接口", weight: 4, notes: "source:youtube" },
  { keyword: "kinetic art installation 2026", type: "SEARCH", category: "科技艺术", weight: 4, notes: "source:vimeo" },
  { keyword: "mechanical art drawing machine demo", type: "SEARCH", category: "科技艺术", weight: 4, notes: "source:vimeo" },
  { keyword: "interactive installation robotic art", type: "SEARCH", category: "科技艺术", weight: 4, notes: "source:vimeo" },
  { keyword: "retro tech gadget interactive toy", type: "SEARCH", category: "玩具化科技", weight: 4, notes: "source:youtube" },
  { keyword: "digital pet toy smart toy demo", type: "SEARCH", category: "玩具化科技", weight: 4, notes: "source:youtube" },
  { keyword: "Japanese gadget clever gadget useful gadget", type: "SEARCH", category: "生活科技小物", weight: 3, notes: "source:youtube" },
  { keyword: "3D printed silicone rapid liquid printing demo", type: "SEARCH", category: "材料科技", weight: 4, notes: "source:youtube" },
  { keyword: "electronic skin smart textile new material demo", type: "SEARCH", category: "材料科技", weight: 4, notes: "source:youtube" },
  { keyword: "exoskeleton clothing walking assist device demo", type: "SEARCH", category: "未来出行", weight: 4, notes: "source:youtube" },
  { keyword: "mobile charging robot future mobility demo", type: "SEARCH", category: "未来出行", weight: 4, notes: "source:youtube" },

  { keyword: "robotics demo OR Kickstarter OR open source", type: "SEARCH", category: "社区信号源", weight: 4, notes: "source:reddit" },
  { keyword: "DIY robot OR maker project OR 3D printed gadget", type: "SEARCH", category: "社区信号源", weight: 4, notes: "source:reddit" },
  { keyword: "assistive technology OR bionic prosthetic OR medical device", type: "SEARCH", category: "社区信号源", weight: 4, notes: "source:reddit" },
  { keyword: "AI hardware robot gadget prototype", type: "SEARCH", category: "社区信号源", weight: 4, notes: "source:hackernews" },
  { keyword: "open source hardware robot demo", type: "SEARCH", category: "开源项目", weight: 4, notes: "source:hackernews" },
  { keyword: "new material manufacturing prototype", type: "SEARCH", category: "研究突破", weight: 3, notes: "source:hackernews" },
  { keyword: "robotics hardware stars:>100 pushed:>2025-11-01", type: "SEARCH", category: "开源项目", weight: 4, notes: "source:github" },
  { keyword: "arduino robot hardware stars:>100 pushed:>2025-11-01", type: "SEARCH", category: "极客DIY", weight: 4, notes: "source:github" },
  { keyword: "assistive technology hardware stars:>50 pushed:>2025-11-01", type: "SEARCH", category: "科技向善", weight: 4, notes: "source:github" },
  { keyword: "brain computer interface neurotechnology", type: "SEARCH", category: "演讲/故事", weight: 4, notes: "source:ted" },
  { keyword: "medical technology assistive technology", type: "SEARCH", category: "演讲/故事", weight: 4, notes: "source:ted" },
  { keyword: "robotics future technology demo", type: "SEARCH", category: "演讲/故事", weight: 3, notes: "source:ted" },
  { keyword: "MIT robotics lab demo", type: "SEARCH", category: "权威机构", weight: 5, notes: "source:authority-youtube" },
  { keyword: "Stanford medical technology lab demo", type: "SEARCH", category: "权威机构", weight: 5, notes: "source:authority-youtube" },
  { keyword: "CMU Robotics lab demo", type: "SEARCH", category: "权威机构", weight: 5, notes: "source:authority-youtube" },
  { keyword: "Mayo Clinic medical technology device", type: "SEARCH", category: "权威机构", weight: 5, notes: "source:authority-youtube" },
  { keyword: "Johns Hopkins assistive technology robot", type: "SEARCH", category: "权威机构", weight: 5, notes: "source:authority-youtube" },

  { keyword: "demo", type: "BOOST", category: "实物演示", weight: 4 },
  { keyword: "prototype", type: "BOOST", category: "原型机", weight: 4 },
  { keyword: "lab demo", type: "BOOST", category: "实验室演示", weight: 5 },
  { keyword: "how it works", type: "BOOST", category: "原理可讲", weight: 4 },
  { keyword: "behind the scenes", type: "BOOST", category: "幕后故事", weight: 4 },
  { keyword: "I built", type: "BOOST", category: "制作过程", weight: 5 },
  { keyword: "open source", type: "BOOST", category: "开源文件", weight: 5 },
  { keyword: "source code", type: "BOOST", category: "开源文件", weight: 4 },
  { keyword: "build guide", type: "BOOST", category: "制作教程", weight: 5 },
  { keyword: "full tutorial", type: "BOOST", category: "制作教程", weight: 4 },
  { keyword: "GitHub", type: "BOOST", category: "开源文件", weight: 4 },
  { keyword: "Show HN", type: "BOOST", category: "社区验证", weight: 4 },
  { keyword: "reddit", type: "BOOST", category: "社区讨论", weight: 2 },
  { keyword: "comments", type: "BOOST", category: "社区讨论", weight: 2 },
  { keyword: "raised over", type: "BOOST", category: "众筹爆火", weight: 4 },
  { keyword: "funded in", type: "BOOST", category: "众筹爆火", weight: 4 },
  { keyword: "viral", type: "BOOST", category: "传播潜力", weight: 3 },
  { keyword: "assistive", type: "BOOST", category: "科技向善", weight: 4 },
  { keyword: "bionic", type: "BOOST", category: "仿生身体", weight: 4 },
  { keyword: "new research", type: "BOOST", category: "研究突破", weight: 4 },
  { keyword: "world's first", type: "BOOST", category: "突破性", weight: 5 },

  { keyword: "unboxing", type: "DEMOTE", category: "普通测评", weight: 4 },
  { keyword: "review", type: "DEMOTE", category: "普通测评", weight: 3 },
  { keyword: "hands-on", type: "DEMOTE", category: "普通测评", weight: 2 },
  { keyword: "camera test", type: "DEMOTE", category: "数码测评", weight: 4 },
  { keyword: "setup", type: "DEMOTE", category: "普通教程", weight: 3 },
  { keyword: "accessory", type: "DEMOTE", category: "普通配件", weight: 3 },
  { keyword: "case", type: "DEMOTE", category: "普通配件", weight: 3 },
  { keyword: "comparison", type: "DEMOTE", category: "普通对比", weight: 3 },
  { keyword: "rumor", type: "DEMOTE", category: "爆料传闻", weight: 4 },
  { keyword: "leak", type: "DEMOTE", category: "爆料传闻", weight: 4 },
  { keyword: "stock news", type: "DEMOTE", category: "金融新闻", weight: 5 },

  { keyword: "giveaway", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "meme", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "prank", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "movie trailer", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "game trailer", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "fan made", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "fake", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "compilation", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "reaction video", type: "EXCLUDE", category: "强排除", weight: 5 },
  { keyword: "celebrity gossip", type: "EXCLUDE", category: "强排除", weight: 5 },

  { keyword: "Kickstarter", type: "AUTHORITY", category: "众筹平台", weight: 5 },
  { keyword: "Indiegogo", type: "AUTHORITY", category: "众筹平台", weight: 5 },
  { keyword: "Product Hunt", type: "AUTHORITY", category: "新产品平台", weight: 4 },
  { keyword: "MIT", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Stanford", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Yale Medicine", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Mayo Clinic", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Johns Hopkins", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Harvard Medical School", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Cleveland Clinic", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "Caltech", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "ETH Zurich", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "CMU Robotics", type: "AUTHORITY", category: "权威机构", weight: 5 },
  { keyword: "BBC", type: "AUTHORITY", category: "权威新闻", weight: 4 },
  { keyword: "Reuters", type: "AUTHORITY", category: "权威新闻", weight: 4 },
  { keyword: "TED", type: "AUTHORITY", category: "演讲平台", weight: 4 },
  { keyword: "GitHub", type: "AUTHORITY", category: "开源项目", weight: 4 },
  { keyword: "Hacker News", type: "AUTHORITY", category: "技术社区", weight: 3 },
  { keyword: "Reddit", type: "AUTHORITY", category: "社区信号源", weight: 2 },
];

type RuleMatch = {
  id: string;
  keyword: string;
  type: ExploreRuleType;
  category: string;
  weight: number;
};

type RunExploreSearchOptions = {
  limitPerRule?: number;
  maxCandidates?: number;
};

function freshnessCutoff() {
  return exploreFreshnessCutoff();
}

function isFreshEnough(video: ExtractedVideo) {
  if (!video.publishedAt) return true;
  return video.publishedAt.getTime() >= freshnessCutoff().getTime();
}

function hasEnoughViewsForAge(video: ExtractedVideo) {
  if (!video.publishedAt || video.viewCount == null) return true;
  return video.publishedAt >= lowViewExploreCutoff() || video.viewCount >= 500;
}

export async function ensureDefaultExploreRules() {
  const existing = await prisma.exploreRule.findMany({
    select: { id: true, keyword: true, type: true, category: true, notes: true },
  });
  const existingKeys = new Set(existing.map((rule) => `${rule.type}:${rule.keyword}`));

  await prisma.exploreRule.updateMany({
    where: {
      keyword: { in: legacyDefaultKeywords },
      type: "SEARCH",
      notes: null,
    },
    data: {
      status: "DISABLED",
      notes: "disabled:legacy-default-replaced-by-tech-chat-rules",
    },
  });

  const missing = defaultRules.filter((rule) => !existingKeys.has(`${rule.type}:${rule.keyword}`));
  if (missing.length === 0) return;

  await prisma.exploreRule.createMany({
    data: missing.map((rule) => ({
      ...rule,
      platform: "YOUTUBE" as Platform,
      status: "ACTIVE",
    })),
    skipDuplicates: true,
  });
}

function includesKeyword(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function matchRules(video: ExtractedVideo, rules: ExploreRule[]) {
  const text = `${video.originalTitle} ${video.description ?? ""} ${video.sourceName}`.toLowerCase();

  return rules
    .filter((rule) => includesKeyword(text, rule.keyword))
    .map((rule) => ({
      id: rule.id,
      keyword: rule.keyword,
      type: rule.type,
      category: rule.category,
      weight: rule.weight,
    }));
}

function sourceFromRule(rule: ExploreRule): ExploreSource {
  const source = rule.notes
    ?.match(/source:(youtube|vimeo|kickstarter|indiegogo|producthunt|reddit|hackernews|github|ted|authority-youtube)/i)?.[1]
    ?.toLowerCase();
  if (
    source === "vimeo" ||
    source === "kickstarter" ||
    source === "indiegogo" ||
    source === "producthunt" ||
    source === "reddit" ||
    source === "hackernews" ||
    source === "github" ||
    source === "ted" ||
    source === "authority-youtube"
  ) {
    return source;
  }
  return "youtube";
}

function scoreVideo(video: ExtractedVideo, matches: RuleMatch[], source: ExploreSource) {
  let score = 42;
  const reasons: string[] = [];
  const text = `${video.originalTitle} ${video.description ?? ""} ${video.sourceName}`.toLowerCase();

  for (const match of matches) {
    if (match.type === "BOOST") {
      score += match.weight * 4;
      reasons.push(`命中加分信号「${match.keyword}」`);
    }
    if (match.type === "DEMOTE") {
      score -= match.weight * 5;
      reasons.push(`命中降权信号「${match.keyword}」`);
    }
    if (match.type === "AUTHORITY") {
      score += match.weight * 5;
      reasons.push(`命中高质量来源「${match.keyword}」`);
    }
    if (match.type === "SEARCH") {
      score += match.weight * 2;
      reasons.push(`匹配方向「${match.category}」`);
    }
  }

  if (["kickstarter", "indiegogo"].includes(source)) score += 12;
  if (source === "vimeo") score += 6;
  if (source === "producthunt") score += 8;
  if (source === "github") score += 10;
  if (source === "hackernews") score += 8;
  if (source === "reddit") score += 4;
  if (source === "ted") score += 8;
  if (source === "authority-youtube") score += 12;
  if (/demo|prototype|lab|built|made|kickstarter|indiegogo|open source|github|stl|cad|tutorial/i.test(text)) {
    score += 10;
  }
  if (/phone|iphone|earbuds|gpu|graphics card|camera test|case\b|rumor|leak/i.test(text)) {
    score -= 15;
  }
  if (video.viewCount && video.viewCount > 10000) score += 6;
  if (video.likeCount && video.likeCount > 500) score += 5;
  if (video.publishedAt) {
    const ageHours = (Date.now() - video.publishedAt.getTime()) / 36e5;
    if (ageHours <= 72) score += 12;
    else if (ageHours <= 24 * 7) score += 8;
    else if (ageHours <= 24 * 90) score += 2;
    else score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    scoreReason: reasons.slice(0, 6).join("；") || "按新奇度、画面感、来源质量和账号适配度评分。",
  };
}

function tagsFromMatches(matches: RuleMatch[], source: ExploreSource) {
  const sourceTag: Record<ExploreSource, string> = {
    youtube: "YouTube",
    vimeo: "Vimeo",
    kickstarter: "Kickstarter",
    indiegogo: "Indiegogo",
    producthunt: "Product Hunt",
    reddit: "Reddit",
    hackernews: "Hacker News",
    github: "GitHub",
    ted: "TED",
    "authority-youtube": "权威机构",
  };
  return Array.from(new Set([sourceTag[source], ...matches.map((match) => match.category)])).slice(0, 8);
}

function firstSearchCategory(matches: RuleMatch[]) {
  return matches.find((match) => match.type === "SEARCH")?.category ?? "科技闲话候选";
}

function hookForVideo(video: ExtractedVideo, matches: RuleMatch[]) {
  const category = firstSearchCategory(matches);
  if (/coffee table/i.test(video.originalTitle)) return "这张咖啡桌可能不只是桌子，而是一台会移动的生活机器人。";
  if (/mri/i.test(video.originalTitle)) return "这台 MRI 不再像一整个房间，而是可能被推到病床边。";
  if (/cnc|printer|factory/i.test(video.originalTitle)) return "以前只有工厂能做的事，正在被缩小到一张桌子上。";
  if (/prosthetic|bionic|assistive|blind/i.test(video.originalTitle)) return "这项技术可能正在把失去的能力一点点还给普通人。";
  if (/art|installation|drawing|kinetic/i.test(video.originalTitle)) return "这个作品把机械结构变成了可以观看的科技表演。";
  return `这个${category}选题有明确画面和技术点，适合继续判断能不能做成视频。`;
}

function recommendationReason(video: ExtractedVideo, matches: RuleMatch[], score: number) {
  const hook = hookForVideo(video, matches);
  const authority = matches.find((match) => match.type === "AUTHORITY");
  const strongest = matches
    .filter((match) => match.type === "BOOST" || match.type === "SEARCH")
    .sort((a, b) => b.weight - a.weight)
    .at(0);

  if (authority) {
    return `一句话钩子：${hook} 推荐原因：命中高质量来源「${authority.keyword}」，评分 ${score}，适合做可信、有解释空间的科技闲话选题。`;
  }
  if (strongest) {
    return `一句话钩子：${hook} 推荐原因：命中「${strongest.keyword}」等信号，评分 ${score}，具备新奇感、画面感或故事入口。`;
  }
  return `一句话钩子：${hook} 推荐原因：${video.sourceName} 的候选内容，评分 ${score}，可作为长尾探索线索。`;
}

type ExploreAggregationMeta = {
  kind: "topicAggregation";
  topicKey: string;
  sources: Array<{
    url: string;
    title: string;
    sourceName: string;
    source: ExploreSource;
    seenAt: string;
  }>;
};

const titleStopWords = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "new",
  "latest",
  "demo",
  "prototype",
  "review",
  "hands",
  "official",
  "video",
  "2025",
  "2026",
]);

function normalizeComparableUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" && pathParts[0]) return `youtube:${pathParts[0]}`;
    if (host.endsWith("youtube.com") && url.searchParams.get("v")) return `youtube:${url.searchParams.get("v")}`;
    if (host.endsWith("vimeo.com") && pathParts[0]) return `vimeo:${pathParts[0]}`;
    if (host.endsWith("github.com") && pathParts.length >= 2) return `github:${pathParts[0]}/${pathParts[1]}`.toLowerCase();
    if (host.endsWith("kickstarter.com") && pathParts[0] === "projects" && pathParts.length >= 3) {
      return `kickstarter:${pathParts[1]}/${pathParts[2]}`.toLowerCase();
    }
    if (host.endsWith("indiegogo.com") && pathParts[0] === "projects" && pathParts[1]) {
      return `indiegogo:${pathParts[1]}`.toLowerCase();
    }
    if (host.endsWith("producthunt.com") && pathParts[0] === "products" && pathParts[1]) {
      return `producthunt:${pathParts[1]}`.toLowerCase();
    }
    if (host.endsWith("ted.com") && pathParts[0] === "talks" && pathParts[1]) {
      return `ted:${pathParts[1]}`.toLowerCase();
    }

    return `${host}/${pathParts.slice(0, 3).join("/")}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function titleTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !titleStopWords.has(token));
}

function titleFingerprint(title: string) {
  return Array.from(new Set(titleTokens(title))).sort().slice(0, 8).join("-");
}

function titleSimilarity(a: string, b: string) {
  const aTokens = new Set(titleTokens(a));
  const bTokens = new Set(titleTokens(b));
  if (aTokens.size < 3 || bTokens.size < 3) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(aTokens.size, bTokens.size);
}

function topicKeyForVideo(video: ExtractedVideo) {
  const urlKey = normalizeComparableUrl(video.originalUrl);
  const titleKey = titleFingerprint(video.originalTitle);
  return titleKey ? `${urlKey}|${titleKey}` : urlKey;
}

function aggregationFromJson(value: Prisma.JsonValue | null | undefined): ExploreAggregationMeta | null {
  if (!Array.isArray(value)) return null;
  return (value.find((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      "kind" in item &&
      (item as { kind?: unknown }).kind === "topicAggregation"
    );
  }) ?? null) as ExploreAggregationMeta | null;
}

function sourceSignal(video: ExtractedVideo, source: ExploreSource) {
  return {
    url: video.originalUrl,
    title: video.originalTitle,
    sourceName: video.sourceName,
    source,
    seenAt: new Date().toISOString(),
  };
}

function mergeAggregation(
  existing: Prisma.JsonValue | null | undefined,
  video: ExtractedVideo,
  source: ExploreSource,
): ExploreAggregationMeta {
  const current = aggregationFromJson(existing);
  const sources = current?.sources ? [...current.sources] : [];
  const signal = sourceSignal(video, source);
  const alreadyTracked = sources.some((item) => item.url === signal.url);
  if (!alreadyTracked) sources.push(signal);

  return {
    kind: "topicAggregation",
    topicKey: current?.topicKey ?? topicKeyForVideo(video),
    sources: sources.slice(-8),
  };
}

function mergeJsonRules(
  existing: Prisma.JsonValue | null | undefined,
  matches: RuleMatch[],
  aggregation: ExploreAggregationMeta,
) {
  const existingRules = Array.isArray(existing)
    ? existing.filter((item) => !(typeof item === "object" && item !== null && "kind" in item))
    : [];
  const ruleKeys = new Set(
    existingRules.map((item) =>
      typeof item === "object" && item !== null && "id" in item ? String((item as { id?: unknown }).id) : JSON.stringify(item),
    ),
  );
  const mergedRules = [...existingRules];
  for (const match of matches) {
    if (!ruleKeys.has(match.id)) mergedRules.push(match);
  }
  return [...mergedRules.slice(-20), aggregation] as Prisma.InputJsonValue;
}

function mergeTags(existing: Prisma.JsonValue | null | undefined, tags: string[], aggregation: ExploreAggregationMeta) {
  const current = Array.isArray(existing) ? existing.map(String) : [];
  const sourceCount = aggregation.sources.length;
  const merged = Array.from(new Set([...current, ...tags, sourceCount > 1 ? `multi-source:${sourceCount}` : null].filter(Boolean)));
  return merged.slice(0, 10) as Prisma.InputJsonValue;
}

function sourceNamesFromAggregation(aggregation: ExploreAggregationMeta) {
  return Array.from(new Set(aggregation.sources.map((item) => item.sourceName))).slice(0, 4).join(" / ");
}

function recommendationWithAggregation(reason: string, aggregation: ExploreAggregationMeta) {
  if (aggregation.sources.length <= 1) return reason;
  return `${reason} Multiple signals: ${aggregation.sources.length} sources have pointed to this topic.`.slice(0, 500);
}

async function findAggregatedCandidate(video: ExtractedVideo) {
  const exact = await prisma.exploreCandidate.findUnique({ where: { originalUrl: video.originalUrl } });
  if (exact) return exact;

  const urlKey = normalizeComparableUrl(video.originalUrl);
  const topicKey = topicKeyForVideo(video);
  const recentCandidates = await prisma.exploreCandidate.findMany({
    where: {
      ...exploreCandidateQualityWhere(),
      status: { not: "REJECTED" },
      discoveredAt: { gte: exploreFreshnessCutoff() },
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 200,
  });

  return (
    recentCandidates.find((candidate) => {
      const aggregation = aggregationFromJson(candidate.matchedRules);
      if (aggregation?.topicKey === topicKey) return true;
      if (normalizeComparableUrl(candidate.originalUrl) === urlKey) return true;
      return titleSimilarity(candidate.originalTitle, video.originalTitle) >= 0.78;
    }) ?? null
  );
}

function todayStart() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return new Date(`${formatter.format(new Date())}T00:00:00+08:00`);
}

async function pickByTags(tags: string[], take: number, excludeIds: string[]) {
  if (take <= 0) return [];
  return prisma.exploreCandidate.findMany({
    where: {
      ...exploreCandidateQualityWhere(),
      status: "UNMARKED",
      id: { notIn: excludeIds },
      AND: [{ OR: tags.map((tag) => ({ tags: { array_contains: [tag] } })) }],
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take,
  });
}

export async function createTodayExplorePicks() {
  const today = todayStart();
  await prisma.exploreCandidate.updateMany({
    where: { isTodayPick: true },
    data: { isTodayPick: false, todayPickDate: null },
  });

  const buckets = [
    { tags: ["AI实体设备", "机器人/仿生", "脑机接口"], take: 2 },
    { tags: ["众筹爆品", "新奇产品", "生活科技小物", "玩具化科技"], take: 2 },
    { tags: ["医疗辅助科技", "科技向善"], take: 2 },
    { tags: ["极客DIY"], take: 1 },
    { tags: ["桌面工厂"], take: 1 },
    { tags: ["科技艺术", "玩具化科技"], take: 1 },
    { tags: ["权威机构", "研究突破", "材料科技"], take: 1 },
  ];

  const candidates = [];
  for (const bucket of buckets) {
    const picked = await pickByTags(bucket.tags, bucket.take, candidates.map((item) => item.id));
    candidates.push(...picked);
  }

  const fill = await prisma.exploreCandidate.findMany({
    where: {
      ...exploreCandidateQualityWhere(),
      status: "UNMARKED",
      id: { notIn: candidates.map((item) => item.id) },
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 10 - candidates.length,
  });

  candidates.push(...fill);
  const finalCandidates = candidates.slice(0, 10);
  await prisma.exploreCandidate.updateMany({
    where: { id: { in: finalCandidates.map((candidate) => candidate.id) } },
    data: { isTodayPick: true, todayPickDate: today },
  });

  return finalCandidates.length;
}

export async function getNextExploreCandidate() {
  const candidates = await prisma.exploreCandidate.findMany({
    where: {
      ...exploreCandidateQualityWhere(),
      status: "UNMARKED",
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 50,
  });

  if (candidates.length === 0) return null;

  const highScorePool = candidates.slice(0, Math.min(20, candidates.length));
  const visualTopicPool = candidates.filter((candidate) =>
    Array.isArray(candidate.tags)
      ? candidate.tags.some((tag) =>
          ["AI实体设备", "机器人/仿生", "极客DIY", "众筹爆品", "桌面工厂", "科技艺术"].includes(String(tag)),
        )
      : false,
  );
  const roll = Math.random();
  const pool =
    roll < 0.7
      ? highScorePool
      : roll < 0.9 && visualTopicPool.length > 0
        ? visualTopicPool
        : candidates;

  return pool[Math.floor(Math.random() * pool.length)];
}

function cleanHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return url;
  }
}

function uniqueByUrl(videos: ExtractedVideo[]) {
  const seen = new Set<string>();
  return videos.filter((video) => {
    if (seen.has(video.originalUrl)) return false;
    seen.add(video.originalUrl);
    return true;
  });
}

function toDateFromUnixSeconds(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000) : undefined;
}

function absoluteUrl(url: string, base: string) {
  try {
    return new URL(url, base).toString();
  } catch {
    return undefined;
  }
}

function isUsefulSignalUrl(url?: string | null) {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com|kickstarter\.com|indiegogo\.com|producthunt\.com|github\.com|ted\.com/i.test(
    url,
  );
}

function redditSearchUrl(query: string, subreddit?: string) {
  const url = new URL(subreddit ? `https://www.reddit.com/r/${subreddit}/search.json` : "https://www.reddit.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "month");
  url.searchParams.set("restrict_sr", subreddit ? "1" : "0");
  return url;
}

async function searchRedditSignals(query: string, limit: number): Promise<ExtractedVideo[]> {
  const subreddits = ["robotics", "DIY", "arduino", "raspberry_pi", "3Dprinting", "Futurology", "technology"];
  const urls = [redditSearchUrl(query), ...subreddits.map((subreddit) => redditSearchUrl(query, subreddit))];
  const candidates: ExtractedVideo[] = [];

  for (const url of urls) {
    if (candidates.length >= limit) break;
    const response = await fetch(url, { headers: { "User-Agent": "TechVExplore/1.0" } });
    if (!response.ok) continue;
    const data = await response.json();
    const rows = Array.isArray(data?.data?.children) ? data.data.children : [];

    for (const row of rows) {
      if (candidates.length >= limit) break;
      const post = row?.data as Record<string, unknown> | undefined;
      if (!post) continue;
      const outboundUrl = typeof post.url === "string" ? post.url : undefined;
      const permalink =
        typeof post.permalink === "string" ? absoluteUrl(post.permalink, "https://www.reddit.com") : undefined;
      const originalUrl = isUsefulSignalUrl(outboundUrl) ? outboundUrl : permalink;
      if (!originalUrl) continue;
      candidates.push({
        platform: "WEB",
        platformVideoId: typeof post.id === "string" ? post.id : undefined,
        originalUrl,
        thumbnailUrl: typeof post.thumbnail === "string" && /^https?:\/\//.test(post.thumbnail) ? post.thumbnail : undefined,
        originalTitle: typeof post.title === "string" ? post.title : titleFromUrl(originalUrl),
        description:
          typeof post.selftext === "string" && post.selftext.trim()
            ? cleanHtml(post.selftext).slice(0, 800)
            : `Reddit signal from r/${post.subreddit ?? "search"}`,
        publishedAt: toDateFromUnixSeconds(post.created_utc),
        viewCount: typeof post.num_comments === "number" ? post.num_comments : undefined,
        likeCount: typeof post.score === "number" ? post.score : undefined,
        sourceName: `Reddit / r/${typeof post.subreddit === "string" ? post.subreddit : "search"}`,
      });
    }
  }

  return uniqueByUrl(candidates).slice(0, limit);
}

async function searchHackerNewsSignals(query: string, limit: number): Promise<ExtractedVideo[]> {
  const cutoff = Math.floor(lowViewExploreCutoff().getTime() / 1000);
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", String(limit));
  url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hacker News search failed: ${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data?.hits) ? data.hits : [];

  return uniqueByUrl(
    rows
      .map((item: Record<string, unknown>) => {
        const storyUrl =
          typeof item.url === "string"
            ? item.url
            : typeof item.objectID === "string"
              ? `https://news.ycombinator.com/item?id=${item.objectID}`
              : undefined;
        if (!storyUrl) return null;
        return {
          platform: "WEB",
          platformVideoId: typeof item.objectID === "string" ? item.objectID : undefined,
          originalUrl: storyUrl,
          originalTitle: typeof item.title === "string" ? item.title : titleFromUrl(storyUrl),
          description: `Hacker News signal. Comments: ${item.num_comments ?? "unknown"}`,
          publishedAt: typeof item.created_at === "string" ? new Date(item.created_at) : undefined,
          viewCount: typeof item.num_comments === "number" ? item.num_comments : undefined,
          likeCount: typeof item.points === "number" ? item.points : undefined,
          sourceName: "Hacker News",
        } satisfies ExtractedVideo;
      })
      .filter(Boolean) as ExtractedVideo[],
  ).slice(0, limit);
}

async function searchGitHubProjects(query: string, limit: number): Promise<ExtractedVideo[]> {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(limit));
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "TechVExplore/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data?.items) ? data.items : [];

  return rows.map((item: Record<string, unknown>) => ({
    platform: "WEB",
    platformVideoId: typeof item.id === "number" ? String(item.id) : undefined,
    originalUrl: typeof item.html_url === "string" ? item.html_url : "https://github.com",
    originalTitle:
      typeof item.full_name === "string"
        ? item.full_name
        : typeof item.name === "string"
          ? item.name
          : "GitHub project",
    description: typeof item.description === "string" ? item.description : undefined,
    publishedAt: typeof item.updated_at === "string" ? new Date(item.updated_at) : undefined,
    viewCount: typeof item.watchers_count === "number" ? item.watchers_count : undefined,
    likeCount: typeof item.stargazers_count === "number" ? item.stargazers_count : undefined,
    sourceName: "GitHub",
  }));
}

async function searchTedTalks(query: string, limit: number): Promise<ExtractedVideo[]> {
  const url = new URL("https://www.ted.com/search");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`TED search failed: ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/href="(\/talks\/[^"#?]+)[^"]*"/g))
    .map((match) => absoluteUrl(match[1], "https://www.ted.com"))
    .filter(Boolean) as string[];

  return uniqueByUrl(
    links.slice(0, limit).map((link) => ({
      platform: "WEB",
      originalUrl: link,
      originalTitle: titleFromUrl(link),
      description: `TED talk matched by query: ${query}`,
      sourceName: "TED",
    })),
  );
}

async function searchVimeoVideos(query: string, limit: number): Promise<ExtractedVideo[]> {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) return [];

  const url = new URL("https://api.vimeo.com/videos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("sort", "date");
  url.searchParams.set("direction", "desc");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Vimeo search failed: ${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data?.data) ? data.data : [];

  return rows.map((item: Record<string, unknown>) => {
    const pictures = item.pictures as { sizes?: Array<{ link?: string }> } | undefined;
    const sizes = pictures?.sizes ?? [];
    const link = typeof item.link === "string" ? item.link : "https://vimeo.com";
    return {
      platform: "WEB",
      platformVideoId: typeof item.uri === "string" ? item.uri : undefined,
      originalUrl: link,
      thumbnailUrl: sizes.at(-1)?.link,
      originalTitle: typeof item.name === "string" ? item.name : titleFromUrl(link),
      description: typeof item.description === "string" ? cleanHtml(item.description) : undefined,
      publishedAt: typeof item.created_time === "string" ? new Date(item.created_time) : undefined,
      sourceName:
        typeof (item.user as { name?: unknown } | undefined)?.name === "string"
          ? String((item.user as { name?: unknown }).name)
          : "Vimeo",
    } satisfies ExtractedVideo;
  });
}

async function searchKickstarterProjects(query: string, limit: number): Promise<ExtractedVideo[]> {
  const url = new URL("https://www.kickstarter.com/discover/advanced");
  url.searchParams.set("term", query);
  url.searchParams.set("sort", "newest");
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Kickstarter search failed: ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/https:\/\/www\.kickstarter\.com\/projects\/[^"'\\\s<>]+/g))
    .map((match) => match[0].split("?")[0])
    .slice(0, limit);

  return uniqueByUrl(
    links.map((link) => ({
      platform: "WEB",
      originalUrl: link,
      originalTitle: titleFromUrl(link),
      description: `Kickstarter project matched by query: ${query}`,
      sourceName: "Kickstarter",
    })),
  );
}

async function searchIndiegogoProjects(query: string, limit: number): Promise<ExtractedVideo[]> {
  const url = new URL("https://www.indiegogo.com/explore/all");
  url.searchParams.set("project_type", "campaign");
  url.searchParams.set("sort", "trending");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Indiegogo search failed: ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/https:\/\/www\.indiegogo\.com\/projects\/[^"'\\\s<>]+/g))
    .map((match) => match[0].split("?")[0])
    .slice(0, limit);

  return uniqueByUrl(
    links.map((link) => ({
      platform: "WEB",
      originalUrl: link,
      originalTitle: titleFromUrl(link),
      description: `Indiegogo campaign matched by query: ${query}`,
      sourceName: "Indiegogo",
    })),
  );
}

async function searchProductHuntProducts(query: string, limit: number): Promise<ExtractedVideo[]> {
  const url = new URL("https://www.producthunt.com/search");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Product Hunt search failed: ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/https:\/\/www\.producthunt\.com\/products\/[^"'\\\s<>]+/g))
    .map((match) => match[0].split("?")[0])
    .slice(0, limit);

  return uniqueByUrl(
    links.map((link) => ({
      platform: "WEB",
      originalUrl: link,
      originalTitle: titleFromUrl(link),
      description: `Product Hunt product matched by query: ${query}`,
      sourceName: "Product Hunt",
    })),
  );
}

async function searchByRule(rule: ExploreRule, limit: number) {
  const source = sourceFromRule(rule);
  if (source === "vimeo") return { source, videos: await searchVimeoVideos(rule.keyword, limit) };
  if (source === "kickstarter") return { source, videos: await searchKickstarterProjects(rule.keyword, limit) };
  if (source === "indiegogo") return { source, videos: await searchIndiegogoProjects(rule.keyword, limit) };
  if (source === "producthunt") return { source, videos: await searchProductHuntProducts(rule.keyword, limit) };
  if (source === "reddit") return { source, videos: await searchRedditSignals(rule.keyword, limit) };
  if (source === "hackernews") return { source, videos: await searchHackerNewsSignals(rule.keyword, limit) };
  if (source === "github") return { source, videos: await searchGitHubProjects(rule.keyword, limit) };
  if (source === "ted") return { source, videos: await searchTedTalks(rule.keyword, limit) };
  if (source === "authority-youtube") return { source, videos: await searchYouTubeVideos(rule.keyword, limit) };
  return { source, videos: await searchYouTubeVideos(rule.keyword, limit) };
}

export async function runExploreSearch(options: RunExploreSearchOptions = {}) {
  await ensureDefaultExploreRules();
  const run = await prisma.exploreRun.create({ data: { status: "SUCCESS" } });

  try {
    const rules = await prisma.exploreRule.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ type: "asc" }, { weight: "desc" }, { createdAt: "asc" }],
    });
    const searchRules = rules.filter((rule) => rule.type === "SEARCH");
    const scoringRules = rules.filter((rule) => rule.type !== "SEARCH");
    const seen = new Set<string>();
    const limitPerRule = options.limitPerRule ?? SEARCH_LIMIT_PER_RULE;
    const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES_PER_RUN;
    const sourceErrors: string[] = [];
    let candidateCount = 0;
    let newCandidateCount = 0;

    for (const rule of searchRules) {
      if (candidateCount >= maxCandidates) break;
      let videos: ExtractedVideo[] = [];
      let source = sourceFromRule(rule);

      try {
        const result = await searchByRule(rule, limitPerRule);
        videos = result.videos;
        source = result.source;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown source error";
        sourceErrors.push(`${source}:${rule.keyword}:${message.slice(0, 160)}`);
        continue;
      }

      for (const video of videos) {
        if (candidateCount >= maxCandidates) break;
        if (!isFreshEnough(video)) continue;
        if (!hasEnoughViewsForAge(video)) continue;
        if (seen.has(video.originalUrl)) continue;
        seen.add(video.originalUrl);
        candidateCount += 1;

        const matches: RuleMatch[] = [
          {
            id: rule.id,
            keyword: rule.keyword,
            type: rule.type,
            category: rule.category,
            weight: rule.weight,
          },
          ...matchRules(video, scoringRules),
        ];
        if (matches.some((match) => match.type === "EXCLUDE")) continue;

        const existing = await findAggregatedCandidate(video);
        const localScore = scoreVideo(video, matches, source);
        const tags = tagsFromMatches(matches, source);
        if (existing) {
          const aggregation = mergeAggregation(existing.matchedRules, video, source);
          const reason = recommendationReason(video, matches, localScore.score);
          await prisma.exploreCandidate.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              thumbnailUrl: existing.thumbnailUrl ?? video.thumbnailUrl,
              publishedAt:
                existing.publishedAt && video.publishedAt
                  ? existing.publishedAt > video.publishedAt
                    ? existing.publishedAt
                    : video.publishedAt
                  : existing.publishedAt ?? video.publishedAt,
              viewCount: Math.max(existing.viewCount ?? 0, video.viewCount ?? 0) || (existing.viewCount ?? video.viewCount),
              likeCount: Math.max(existing.likeCount ?? 0, video.likeCount ?? 0) || (existing.likeCount ?? video.likeCount),
              sourceName: sourceNamesFromAggregation(aggregation) || existing.sourceName,
              score: Math.max(existing.score, localScore.score + Math.min(8, aggregation.sources.length * 2)),
              scoreReason: `${existing.scoreReason ?? ""}; aggregated ${aggregation.sources.length} source signals`.slice(0, 300),
              tags: mergeTags(existing.tags, tags, aggregation),
              matchedRules: mergeJsonRules(existing.matchedRules, matches, aggregation),
              recommendationReason: recommendationWithAggregation(existing.recommendationReason ?? reason, aggregation),
            },
          });
          continue;
        }

        let ai = {
          chineseTitle: video.originalTitle,
          chineseSummary: "探索候选内容，等待后续 AI 摘要优化。",
          score: localScore.score,
          scoreReason: localScore.scoreReason,
        };

        try {
          ai = await analyzeVideoWithMinimax({
            title: video.originalTitle,
            description: video.description,
            sourceName: video.sourceName,
            platform: video.platform,
            likeCount: video.likeCount,
            publishedAt: video.publishedAt,
          });
        } catch {
          // Keep local scoring and fallback text when AI is unavailable.
        }

        const finalScore = Math.round((ai.score + localScore.score) / 2);
        const aggregation = mergeAggregation(null, video, source);
        await prisma.exploreCandidate.create({
          data: {
            platform: video.platform,
            platformContentId: video.platformVideoId,
            originalUrl: video.originalUrl,
            thumbnailUrl: video.thumbnailUrl,
            originalTitle: video.originalTitle,
            chineseTitle: ai.chineseTitle,
            description: video.description,
            chineseSummary: ai.chineseSummary,
            publishedAt: video.publishedAt,
            likeCount: video.likeCount,
            viewCount: video.viewCount,
            sourceName: video.sourceName,
            sourceType: firstSearchCategory(matches),
            score: finalScore,
            scoreReason: `${ai.scoreReason}；${localScore.scoreReason}`.slice(0, 300),
            tags: mergeTags(null, tags, aggregation),
            matchedRules: mergeJsonRules(null, matches, aggregation),
            recommendationReason: recommendationReason(video, matches, finalScore),
          },
        });
        newCandidateCount += 1;
      }
    }

    await createTodayExplorePicks();
    await prisma.exploreRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        searchedRuleCount: searchRules.length,
        candidateCount,
        newCandidateCount,
        errorMessage: sourceErrors.length > 0 ? sourceErrors.slice(0, 6).join("\n") : null,
      },
    });

    return {
      searchedRuleCount: searchRules.length,
      candidateCount,
      newCandidateCount,
      sourceErrors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown explore error";
    await prisma.exploreRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 1000) },
    });
    throw error;
  }
}
