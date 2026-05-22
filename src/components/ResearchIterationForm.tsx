"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchIterationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    const instruction = String(formData.get("instruction") ?? "").trim();
    if (!instruction) {
      setMessage("请先写下本轮要继续研究或调整的方向。");
      return;
    }

    submittingRef.current = true;
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
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-col gap-2 xl:flex-row">
        <textarea
          name="instruction"
          required
          rows={1}
          placeholder="写下新的研究方向、补查对象或改题思路。"
          className="min-h-10 flex-1 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 shrink-0 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:bg-zinc-400"
        >
          {isSubmitting ? "继续研究中..." : "生成新版报告"}
        </button>
      </div>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </form>
  );
}
