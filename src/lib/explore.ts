import type { ExploreRule, ExploreRuleType, Platform, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { analyzeVideoWithMinimax } from "./minimax";
import type { ExtractedVideo } from "./types";
import { searchYouTubeVideos } from "./yt-dlp";

const SEARCH_LIMIT_PER_RULE = 10;
const MAX_CANDIDATES_PER_RUN = 100;
const MAX_EXPLORE_CONTENT_AGE_DAYS = 730;
const MAX_EXPLORE_CONTENT_AGE_MS = MAX_EXPLORE_CONTENT_AGE_DAYS * 24 * 60 * 60 * 1000;

const defaultRules: Array<{
  keyword: string;
  type: ExploreRuleType;
  category: string;
  weight: number;
  notes?: string;
}> = [
  { keyword: "portable MRI", type: "SEARCH", category: "医疗科技", weight: 5 },
  { keyword: "medical robot", type: "SEARCH", category: "医疗科技", weight: 5 },
  { keyword: "brain computer interface", type: "SEARCH", category: "脑机接口", weight: 5 },
  { keyword: "robotic surgery", type: "SEARCH", category: "医疗机器人", weight: 5 },
  { keyword: "AI wearable", type: "SEARCH", category: "AI 硬件", weight: 4 },
  { keyword: "lab tour neurotechnology", type: "SEARCH", category: "科学技术探秘", weight: 4 },
  { keyword: "DIY robot arm", type: "SEARCH", category: "DIY / Maker", weight: 4 },
  { keyword: "Kickstarter AI pet", type: "SEARCH", category: "众筹科技产品", weight: 4 },
  { keyword: "TED medical technology", type: "SEARCH", category: "TED 科技演讲", weight: 3 },
  { keyword: "micro robot medical", type: "SEARCH", category: "微型机器人", weight: 4 },
  { keyword: "breakthrough", type: "BOOST", category: "前沿技术", weight: 4 },
  { keyword: "prototype", type: "BOOST", category: "产品原型", weight: 3 },
  { keyword: "first look", type: "BOOST", category: "新产品", weight: 3 },
  { keyword: "new research", type: "BOOST", category: "科研成果", weight: 4 },
  { keyword: "lab demo", type: "BOOST", category: "实验室演示", weight: 4 },
  { keyword: "clinical trial", type: "BOOST", category: "医疗科技", weight: 4 },
  { keyword: "portable", type: "BOOST", category: "便携设备", weight: 3 },
  { keyword: "miniature", type: "BOOST", category: "微型设备", weight: 3 },
  { keyword: "world's first", type: "BOOST", category: "突破性", weight: 4 },
  { keyword: "unboxing", type: "DEMOTE", category: "低优先级", weight: 3 },
  { keyword: "review", type: "DEMOTE", category: "低优先级", weight: 2 },
  { keyword: "setup", type: "DEMOTE", category: "低优先级", weight: 2 },
  { keyword: "accessory", type: "DEMOTE", category: "低优先级", weight: 2 },
  { keyword: "reaction", type: "DEMOTE", category: "低优先级", weight: 3 },
  { keyword: "gaming setup", type: "DEMOTE", category: "低优先级", weight: 3 },
  { keyword: "giveaway", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "meme", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "fake", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "prank", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "movie trailer", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "game trailer", type: "EXCLUDE", category: "排除", weight: 5 },
  { keyword: "MIT", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Stanford", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Yale Medicine", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Mayo Clinic", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Johns Hopkins", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "BBC", type: "AUTHORITY", category: "权威新闻", weight: 4 },
  { keyword: "Reuters", type: "AUTHORITY", category: "权威新闻", weight: 4 },
  { keyword: "Harvard Medical School", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Cleveland Clinic", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "Caltech", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "ETH Zurich", type: "AUTHORITY", category: "权威来源", weight: 5 },
  { keyword: "CMU Robotics", type: "AUTHORITY", category: "权威来源", weight: 5 },
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
  return new Date(Date.now() - MAX_EXPLORE_CONTENT_AGE_MS);
}

function isFreshEnough(video: ExtractedVideo) {
  if (!video.publishedAt) return true;
  return video.publishedAt.getTime() >= freshnessCutoff().getTime();
}

export async function ensureDefaultExploreRules() {
  const count = await prisma.exploreRule.count();
  if (count > 0) return;

  await prisma.exploreRule.createMany({
    data: defaultRules.map((rule) => ({
      ...rule,
      platform: "YOUTUBE" as Platform,
      status: "ACTIVE",
    })),
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

function scoreVideo(video: ExtractedVideo, matches: RuleMatch[]) {
  let score = 45;
  const reasons: string[] = [];

  for (const match of matches) {
    if (match.type === "BOOST") {
      score += match.weight * 4;
      reasons.push(`命中加分关键词「${match.keyword}」`);
    }
    if (match.type === "DEMOTE") {
      score -= match.weight * 4;
      reasons.push(`命中降权关键词「${match.keyword}」`);
    }
    if (match.type === "AUTHORITY") {
      score += match.weight * 5;
      reasons.push(`命中权威来源「${match.keyword}」`);
    }
    if (match.type === "SEARCH") {
      score += match.weight * 2;
    }
  }

  if (video.viewCount && video.viewCount > 10000) score += 8;
  if (video.likeCount && video.likeCount > 500) score += 6;
  if (video.publishedAt) {
    const ageHours = (Date.now() - video.publishedAt.getTime()) / 36e5;
    if (ageHours <= 72) score += 10;
    if (ageHours > 24 * 60) score -= 8;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    scoreReason: reasons.slice(0, 4).join("；") || "根据搜索关键词、新鲜度和基础热度评分。",
  };
}

function tagsFromMatches(matches: RuleMatch[]) {
  return Array.from(new Set(matches.map((match) => match.category))).slice(0, 6);
}

function recommendationReason(video: ExtractedVideo, matches: RuleMatch[], score: number) {
  const authority = matches.find((match) => match.type === "AUTHORITY");
  if (authority) {
    return `来自或命中权威来源「${authority.keyword}」，评分 ${score}，适合作为高可信科技选题线索。`;
  }

  const strongest = matches
    .filter((match) => match.type === "BOOST")
    .sort((a, b) => b.weight - a.weight)
    .at(0);
  if (strongest) {
    return `命中「${strongest.keyword}」等科技选题信号，评分 ${score}，值得进一步判断视觉表达和研究价值。`;
  }

  return `${video.sourceName} 的候选内容，评分 ${score}，可作为长尾探索线索。`;
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

export async function createTodayExplorePicks() {
  const today = todayStart();
  const cutoff = freshnessCutoff();
  await prisma.exploreCandidate.updateMany({
    where: { isTodayPick: true },
    data: { isTodayPick: false, todayPickDate: null },
  });

  const authority = await prisma.exploreCandidate.findMany({
    where: {
      status: "UNMARKED",
      OR: [
        { publishedAt: null },
        { publishedAt: { gte: cutoff } },
      ],
      AND: [{ OR: [{ sourceType: "权威来源" }, { tags: { array_contains: ["权威来源"] } }] }],
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 3,
  });

  const products = await prisma.exploreCandidate.findMany({
    where: {
      status: "UNMARKED",
      OR: [
        { publishedAt: null },
        { publishedAt: { gte: cutoff } },
      ],
      tags: { array_contains: ["众筹科技产品"] },
      id: { notIn: authority.map((item) => item.id) },
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 2,
  });

  const makers = await prisma.exploreCandidate.findMany({
    where: {
      status: "UNMARKED",
      OR: [
        { publishedAt: null },
        { publishedAt: { gte: cutoff } },
      ],
      tags: { array_contains: ["DIY / Maker"] },
      id: { notIn: [...authority, ...products].map((item) => item.id) },
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 2,
  });

  const pickedIds = [...authority, ...products, ...makers].map((item) => item.id);
  const fill = await prisma.exploreCandidate.findMany({
    where: {
      status: "UNMARKED",
      id: { notIn: pickedIds },
      OR: [
        { publishedAt: null },
        { publishedAt: { gte: cutoff } },
      ],
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 10 - pickedIds.length,
  });

  const candidates = [...authority, ...products, ...makers, ...fill].slice(0, 10);
  await prisma.exploreCandidate.updateMany({
    where: { id: { in: candidates.map((candidate) => candidate.id) } },
    data: { isTodayPick: true, todayPickDate: today },
  });

  return candidates.length;
}

export async function getNextExploreCandidate() {
  const cutoff = freshnessCutoff();
  const candidates = await prisma.exploreCandidate.findMany({
    where: {
      status: "UNMARKED",
      OR: [
        { publishedAt: null },
        { publishedAt: { gte: cutoff } },
      ],
    },
    orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
    take: 50,
  });

  if (candidates.length === 0) return null;

  const highScorePool = candidates.slice(0, Math.min(20, candidates.length));
  const authorityPool = candidates.filter((candidate) => candidate.sourceType === "权威来源");
  const roll = Math.random();
  const pool =
    roll < 0.7
      ? highScorePool
      : roll < 0.9 && authorityPool.length > 0
        ? authorityPool
        : candidates;

  return pool[Math.floor(Math.random() * pool.length)];
}

export async function runExploreSearch(options: RunExploreSearchOptions = {}) {
  await ensureDefaultExploreRules();
  const run = await prisma.exploreRun.create({ data: { status: "SUCCESS" } });

  try {
    const rules = await prisma.exploreRule.findMany({
      where: { status: "ACTIVE", platform: "YOUTUBE" },
      orderBy: [{ type: "asc" }, { weight: "desc" }],
    });
    const searchRules = rules.filter((rule) => rule.type === "SEARCH").slice(0, 10);
    const scoringRules = rules.filter((rule) => rule.type !== "SEARCH");
    const seen = new Set<string>();
    const limitPerRule = options.limitPerRule ?? SEARCH_LIMIT_PER_RULE;
    const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES_PER_RUN;
    let candidateCount = 0;
    let newCandidateCount = 0;

    for (const rule of searchRules) {
      if (candidateCount >= maxCandidates) break;
      const videos = await searchYouTubeVideos(rule.keyword, limitPerRule);

      for (const video of videos) {
        if (candidateCount >= maxCandidates) break;
        if (!isFreshEnough(video)) continue;
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

        const existing = await prisma.exploreCandidate.findUnique({
          where: { originalUrl: video.originalUrl },
        });
        if (existing) {
          await prisma.exploreCandidate.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              viewCount: video.viewCount,
              likeCount: video.likeCount,
              score: Math.max(existing.score, scoreVideo(video, matches).score),
            },
          });
          continue;
        }

        const localScore = scoreVideo(video, matches);
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
        const tags = tagsFromMatches(matches);
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
            sourceType: matches.some((match) => match.type === "AUTHORITY") ? "权威来源" : "平台搜索",
            score: finalScore,
            scoreReason: `${ai.scoreReason}；${localScore.scoreReason}`.slice(0, 200),
            tags: tags as Prisma.InputJsonValue,
            matchedRules: matches as Prisma.InputJsonValue,
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
      },
    });

    return { searchedRuleCount: searchRules.length, candidateCount, newCandidateCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown explore error";
    await prisma.exploreRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 1000) },
    });
    throw error;
  }
}
