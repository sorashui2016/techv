"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function VideoOpenLink({
  videoId,
  originalUrl,
  className,
  children,
}: {
  videoId: string;
  originalUrl: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  async function openOriginal() {
    await fetch(`/api/videos/${videoId}/view`, { method: "POST" });
    window.open(originalUrl, "_blank", "noopener,noreferrer");
    router.refresh();
  }

  return (
    <button type="button" onClick={openOriginal} className={className}>
      {children}
    </button>
  );
}
