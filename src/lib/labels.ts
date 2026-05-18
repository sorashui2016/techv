import type { DecisionStatus, Platform, SourceTier, ViewState } from "@prisma/client";

export const decisionLabels: Record<DecisionStatus, string> = {
  UNMARKED: "未标记",
  CANDIDATE: "备选",
  DONE: "已做",
  PENDING: "待定",
  REJECTED: "不做",
};

export const viewLabels: Record<ViewState, string> = {
  UNVIEWED: "未看",
  VIEWED: "已看",
};

export const tierLabels: Record<SourceTier, string> = {
  NORMAL: "普通账号",
  IMPORTANT: "重要账号",
};

export const platformLabels: Record<Platform, string> = {
  YOUTUBE: "YouTube",
  RSS: "RSS",
  WEB: "网页",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};
