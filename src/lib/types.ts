import type { Platform, SourceTier } from "@prisma/client";

export type ExtractedVideo = {
  platform: Platform;
  platformVideoId?: string;
  originalUrl: string;
  canonicalUrl?: string;
  thumbnailUrl?: string;
  originalTitle: string;
  description?: string;
  publishedAt?: Date;
  likeCount?: number;
  sourceName: string;
};

export type AiVideoInput = {
  title: string;
  description?: string | null;
  sourceName?: string | null;
  platform?: Platform;
  sourceTier?: SourceTier;
  publishedAt?: Date | null;
  likeCount?: number | null;
};

export type AiVideoOutput = {
  chineseTitle: string;
  chineseSummary: string;
  score: number;
  scoreReason: string;
};
