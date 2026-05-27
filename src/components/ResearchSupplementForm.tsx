"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchSupplementForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMessage(null);
    const response = await fetch(`/api/research/projects/${projectId}/supplements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "NOTE",
        content: String(formData.get("content") ?? ""),
        notes: "用户补充关键词",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "保存关键词失败");
      return;
    }
    setMessage("关键词已保存");
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-col gap-2 xl:flex-row">
        <textarea
          name="content"
          required
          rows={1}
          placeholder="输入补充关键词，例如：产品名、公司名、技术路线、竞品、人物或英文搜索词"
          className="min-h-10 flex-1 resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm leading-6"
        />
        <button className="h-10 shrink-0 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
          保存关键词
        </button>
      </div>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </form>
  );
}
