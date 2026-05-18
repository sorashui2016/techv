import type { SourceTier } from "@prisma/client";
import type { ExtractedVideo } from "./types";

export function ruleScore(video: ExtractedVideo, sourceTier: SourceTier = "NORMAL") {
  let score = sourceTier === "IMPORTANT" ? 68 : 48;
  const text = `${video.originalTitle} ${video.description ?? ""}`.toLowerCase();

  const signals = [
    "ai",
    "robot",
    "iphone",
    "openai",
    "google",
    "nvidia",
    "tesla",
    "apple",
    "chip",
    "gpu",
    "review",
    "launch",
  ];

  score += signals.filter((signal) => text.includes(signal)).length * 3;

  if (video.likeCount && video.likeCount > 500) score += 6;
  if (video.likeCount && video.likeCount > 5000) score += 8;

  if (video.publishedAt) {
    const ageHours = (Date.now() - video.publishedAt.getTime()) / 36e5;
    if (ageHours <= 24) score += 10;
    if (ageHours <= 72) score += 4;
    if (ageHours > 168) score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
