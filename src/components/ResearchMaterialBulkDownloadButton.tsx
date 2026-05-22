"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchMaterialBulkDownloadButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadAll() {
    setIsDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/research/projects/${projectId}/materials/download`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "批量下载失败");
      setMessage(`完成 ${data.downloaded ?? 0} 条，失败 ${data.failed ?? 0} 条`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量下载失败");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadAll}
        disabled={disabled || isDownloading}
        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:bg-zinc-300"
      >
        {isDownloading ? "一键下载中..." : "一键下载剩余素材"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}
