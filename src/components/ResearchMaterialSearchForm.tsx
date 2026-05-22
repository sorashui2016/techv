"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchMaterialSearchForm({
  projectId,
  finalVersionNumber,
}: {
  projectId: string;
  finalVersionNumber?: number | null;
}) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<"append" | "replace" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search(mode: "append" | "replace") {
    if (!finalVersionNumber) {
      setMessage("请先在报告版本里设置最终主题，再搜索素材。");
      return;
    }
    setIsSubmitting(mode);
    setMessage(null);
    try {
      const response = await fetch(`/api/research/projects/${projectId}/materials/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "素材搜索失败");
      const versionText = data.reportVersion ? `，基于最终版 V${data.reportVersion}` : "";
      setMessage(`${mode === "replace" ? "重新搜索" : "补充搜索"}完成${versionText}：${data.total ?? 0} 条候选`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "素材搜索失败");
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="mb-2 text-xs leading-5 text-zinc-500">
        素材搜索基于已设置的最终主题版本；未设置最终主题前不能搜索。补充搜索会保留已有素材，重新搜索会清空未下载且未进垃圾箱的普通候选。
      </p>
      {!finalVersionNumber ? (
        <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          请先在“报告版本”里点击“设置为最终主题”。
        </p>
      ) : (
        <p className="mb-2 text-xs font-medium text-emerald-700">当前素材搜索基于最终版 V{finalVersionNumber}</p>
      )}
      <div className="flex flex-col gap-2 lg:flex-row">
        <input
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="补充搜索方向，例如：只找官方发布会视频、产品实拍，不要评测。"
          className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => search("append")}
            disabled={isSubmitting !== null || !finalVersionNumber}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {isSubmitting === "append" ? "补充中..." : "补充搜索"}
          </button>
          <button
            type="button"
            onClick={() => search("replace")}
            disabled={isSubmitting !== null || !finalVersionNumber}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
          >
            {isSubmitting === "replace" ? "重搜中..." : "重新搜索"}
          </button>
        </div>
      </div>
      {message ? <p className="mt-2 text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}
