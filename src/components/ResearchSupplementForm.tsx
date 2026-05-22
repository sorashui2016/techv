"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchSupplementType } from "@prisma/client";

const supplementTypes: Array<{ value: ResearchSupplementType; label: string }> = [
  { value: "TITLE", label: "标题" },
  { value: "BODY", label: "正文" },
  { value: "SHARE_TEXT", label: "分享文案" },
  { value: "COMMENT", label: "评论" },
  { value: "TRANSCRIPT", label: "转写文本" },
  { value: "SUBTITLE", label: "字幕" },
  { value: "LINK", label: "相关链接" },
  { value: "NOTE", label: "备注" },
];

export function ResearchSupplementForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMessage(null);
    const response = await fetch(`/api/research/projects/${projectId}/supplements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: String(formData.get("type") ?? "BODY"),
        content: String(formData.get("content") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "补充材料失败");
      return;
    }
    setMessage("补充材料已保存");
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <select name="type" defaultValue="BODY" className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
          {supplementTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <input name="notes" placeholder="备注，可选" className="min-w-0 flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-2 xl:flex-row">
        <textarea
          name="content"
          required
          rows={1}
          placeholder="粘贴转写、字幕、正文、评论、分享文案或链接。"
          className="min-h-10 flex-1 resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm leading-6"
        />
        <button className="h-10 shrink-0 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
          保存补充材料
        </button>
      </div>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </form>
  );
}
