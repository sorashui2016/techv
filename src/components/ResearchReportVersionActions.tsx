"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchReportVersionActions({
  versionId,
  compact = false,
}: {
  versionId: string;
  compact?: boolean;
}) {
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
      if (!response.ok) throw new Error(data.error ?? "设置最终主题失败");
      setMessage("已设为最终主题");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "设置最终主题失败");
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
        className={`rounded-md border border-emerald-300 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100 disabled:bg-zinc-100 disabled:text-zinc-400 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
        }`}
      >
        {isSubmitting ? "设置中..." : "设为最终主题"}
      </button>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </div>
  );
}
