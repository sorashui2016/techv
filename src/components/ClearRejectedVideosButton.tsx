"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClearRejectedVideosButton({ count }: { count: number }) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function clearRejected() {
    const confirmed = window.confirm(`确定清空“不做”池里的 ${count} 条内容吗？此操作会删除雷达和探索里的不做记录。`);
    if (!confirmed) return;

    setIsClearing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/videos/rejected", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "清空失败");
      setMessage(`已清空 ${data.deletedCount} 条`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空失败");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <button
        type="button"
        onClick={clearRejected}
        disabled={isClearing || count === 0}
        className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-rose-300"
      >
        {isClearing ? "正在清空..." : "清空不做池"}
      </button>
      <span className="text-sm text-rose-800">
        当前不做池共 {count} 条。清空后只删除内容记录，不会删除信息源或探索规则。
      </span>
      {message ? <span className="text-sm font-medium text-rose-900">{message}</span> : null}
    </div>
  );
}
