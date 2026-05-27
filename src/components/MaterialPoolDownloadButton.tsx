"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MaterialPoolDownloadButton({
  endpoint,
  disabled = false,
}: {
  endpoint: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadPool() {
    setIsDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "素材池下载失败");
      setMessage(`完成 ${data.downloaded ?? 0} 条，跳过 ${data.skipped ?? 0} 条，失败 ${data.failed ?? 0} 条`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "素材池下载失败");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <button
        type="button"
        onClick={downloadPool}
        disabled={disabled || isDownloading}
        className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {isDownloading ? "一键下载中..." : "一键下载素材池"}
      </button>
      {message ? <span className="text-sm text-emerald-900">{message}</span> : null}
    </div>
  );
}
