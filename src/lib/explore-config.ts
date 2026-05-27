export const MAX_EXPLORE_CONTENT_AGE_DAYS = 180;
export const LOW_VIEW_EXPLORE_AGE_DAYS = 30;
export const LOW_VIEW_EXPLORE_MIN_VIEWS = 500;

export function exploreFreshnessCutoff(now = Date.now()) {
  return new Date(now - MAX_EXPLORE_CONTENT_AGE_DAYS * 24 * 60 * 60 * 1000);
}

export function lowViewExploreCutoff(now = Date.now()) {
  return new Date(now - LOW_VIEW_EXPLORE_AGE_DAYS * 24 * 60 * 60 * 1000);
}

export function exploreCandidateQualityWhere() {
  const freshnessCutoff = exploreFreshnessCutoff();
  const lowViewCutoff = lowViewExploreCutoff();

  return {
    OR: [{ publishedAt: null }, { publishedAt: { gte: freshnessCutoff } }],
    NOT: {
      AND: [
        { publishedAt: { lt: lowViewCutoff } },
        { viewCount: { not: null } },
        { viewCount: { lt: LOW_VIEW_EXPLORE_MIN_VIEWS } },
      ],
    },
  };
}
