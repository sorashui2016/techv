import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendFeishuVideoMessage } from "./feishu";
import { analyzeVideoWithMinimax } from "./minimax";
import { ruleScore } from "./scoring";
import { extractRecentVideos, extractVideo } from "./yt-dlp";
import type { ExtractedVideo } from "./types";

async function upsertVideo(
  video: ExtractedVideo,
  source?: { id: string; name: string; tier: "NORMAL" | "IMPORTANT" },
) {
  const existing = await prisma.videoItem.findUnique({
    where: { originalUrl: video.originalUrl },
  });

  if (existing) {
    await prisma.videoItem.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        likeCount: video.likeCount ?? existing.likeCount,
        thumbnailUrl: video.thumbnailUrl ?? existing.thumbnailUrl,
        publishedAt: video.publishedAt ?? existing.publishedAt,
        description: video.description ?? existing.description,
        sourceName: source?.name ?? video.sourceName,
      },
    });
    return { created: false };
  }

  const fallbackScore = ruleScore(video, source?.tier);

  let ai;
  try {
    ai = await analyzeVideoWithMinimax({
      title: video.originalTitle,
      description: video.description,
      sourceName: source?.name ?? video.sourceName,
      platform: video.platform,
      sourceTier: source?.tier,
      publishedAt: video.publishedAt,
      likeCount: video.likeCount,
    });
  } catch (error) {
    ai = {
      chineseTitle: video.originalTitle,
      chineseSummary: "AI 处理失败，已入库等待后续重试。",
      score: fallbackScore,
      scoreReason: error instanceof Error ? error.message.slice(0, 180) : "AI 处理失败",
    };
  }

  const createdVideo = await prisma.videoItem.create({
    data: {
      sourceId: source?.id,
      platform: video.platform,
      platformVideoId: video.platformVideoId,
      originalUrl: video.originalUrl,
      canonicalUrl: video.canonicalUrl,
      thumbnailUrl: video.thumbnailUrl,
      originalTitle: video.originalTitle,
      chineseTitle: ai.chineseTitle,
      description: video.description,
      chineseSummary: ai.chineseSummary,
      publishedAt: video.publishedAt,
      likeCount: video.likeCount,
      sourceName: source?.name ?? video.sourceName,
      score: ai.score,
      scoreReason: ai.scoreReason,
      processingStatus: "READY",
      translationStatus: "READY",
      summaryStatus: "READY",
      pushStatus: source?.tier === "IMPORTANT" ? "PENDING" : "NOT_REQUIRED",
    },
  });

  if (source?.tier === "IMPORTANT") {
    try {
      const pushResult = await sendFeishuVideoMessage({
        title: ai.chineseTitle,
        originalTitle: video.originalTitle,
        summary: ai.chineseSummary,
        score: ai.score,
        sourceName: source.name,
        originalUrl: video.originalUrl,
        publishedAt: video.publishedAt,
      });

      if (!pushResult.skipped) {
        await prisma.videoItem.update({
          where: { id: createdVideo.id },
          data: { pushStatus: "SENT" },
        });
        await prisma.pushEvent.create({
          data: {
            videoId: createdVideo.id,
            provider: "feishu",
            status: "SENT",
            payload: pushResult.response ?? undefined,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Feishu push failed";
      await prisma.videoItem.update({
        where: { id: createdVideo.id },
        data: { pushStatus: "FAILED" },
      });
      await prisma.pushEvent.create({
        data: {
          videoId: createdVideo.id,
          provider: "feishu",
          status: "FAILED",
          error: message.slice(0, 1000),
        },
      });
    }
  }

  return { created: true };
}

export async function submitVideoLink(url: string) {
  const video = await extractVideo(url);
  return upsertVideo(video);
}

export async function monitorSource(sourceId: string) {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  const run = await prisma.monitorRun.create({
    data: { sourceId: source.id, status: "SUCCESS" },
  });

  let newVideoCount = 0;
  let updatedCount = 0;

  try {
    const videos = await extractRecentVideos(source.url);

    for (const video of videos) {
      const result = await upsertVideo(video, {
        id: source.id,
        name: source.name,
        tier: source.tier,
      });
      if (result.created) newVideoCount += 1;
      else updatedCount += 1;
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastCheckStatus: "success",
        lastCheckError: null,
      },
    });

    await prisma.monitorRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), newVideoCount, updatedCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown monitor error";

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastCheckStatus: "failed",
        lastCheckError: message.slice(0, 500),
      },
    });

    await prisma.monitorRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        newVideoCount,
        updatedCount,
        errorMessage: message.slice(0, 1000),
      },
    });

    throw error;
  }

  return { newVideoCount, updatedCount };
}

export async function monitorDueSources(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );

  const sources = await prisma.source.findMany({ where: { status: "ACTIVE" } });
  const due = sources.filter((source) => {
    if (source.tier === "IMPORTANT") return [0, 4, 8, 12, 16, 20].includes(hour);
    return hour === 8;
  });

  const results = [];
  for (const source of due) {
    try {
      results.push({ sourceId: source.id, ok: true, ...(await monitorSource(source.id)) });
    } catch (error) {
      results.push({
        sourceId: source.id,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown monitor error",
      });
    }
  }

  return results;
}

export async function monitorAllSources() {
  const sources = await prisma.source.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const results = [];
  for (const source of sources) {
    try {
      results.push({ sourceId: source.id, sourceName: source.name, ok: true, ...(await monitorSource(source.id)) });
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown monitor error",
      });
    }
  }

  return results;
}

export function isKnownPrismaConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientKnownRequestError
  );
}
