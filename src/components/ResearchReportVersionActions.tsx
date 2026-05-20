"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchReportVersionActions({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function confirmTheme() {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/research/report-versions/${versionId}/final`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "确认主题失败");
      setMessage("已确认主题，可以进入素材搜索。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "确认主题失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={confirmTheme}
        disabled={isSubmitting}
        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400"
      >
        {isSubmitting ? "确认中..." : "设为最终主题"}
      </button>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </div>
  );
}
