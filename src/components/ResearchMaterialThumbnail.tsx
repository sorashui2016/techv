"use client";

import { useMemo, useState } from "react";

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0];
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? undefined;
  } catch {
    // Fall through to regex fallback.
  }

  return url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]+)/)?.[1];
}

export function ResearchMaterialThumbnail({
  thumbnailUrl,
  sourceUrl,
  title,
}: {
  thumbnailUrl?: string | null;
  sourceUrl: string;
  title: string;
}) {
  const candidates = useMemo(() => {
    const urls = thumbnailUrl ? [thumbnailUrl] : [];
    const videoId = youtubeVideoId(sourceUrl);
    if (videoId) {
      urls.push(
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/default.jpg`,
      );
    }
    return Array.from(new Set(urls));
  }, [sourceUrl, thumbnailUrl]);

  const [index, setIndex] = useState(0);
  const current = candidates[index];

  if (!current) {
    return <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-500">暂无封面</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={title}
      className="h-full w-full object-cover"
      onError={() => setIndex((value) => value + 1)}
    />
  );
}
