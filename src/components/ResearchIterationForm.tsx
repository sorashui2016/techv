"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchIterationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    const instruction = String(formData.get("instruction") ?? "").trim();
    if (!instruction) {
      setMessage("请先写下本轮要继续研究或调整的方向。");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/research/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "继续研究失败");
      setMessage("新版报告已生成。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "继续研究失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <textarea
        name="instruction"
        required
        rows={5}
        placeholder="写下你看完报告后的新方向。例如：把主题从单个 Apple 无障碍配件扩展成 Apple 无障碍设计合集，重点补充 VoiceOver、AssistiveTouch、Live Captions、Magnifier、Switch Control 等案例。"
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
        >
          {isSubmitting ? "继续研究中..." : "生成新版报告"}
        </button>
        {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
      </div>
    </form>
  );
}
