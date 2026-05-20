"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchNewForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMessage(null);
    const response = await fetch("/api/research/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalUrl: String(formData.get("originalUrl") ?? ""),
        title: String(formData.get("title") ?? ""),
        supplementalText: String(formData.get("supplementalText") ?? ""),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "创建研究项目失败");
      return;
    }
    router.push(`/research/${data.id}`);
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <input
        name="originalUrl"
        required
        placeholder="研究链接：YouTube / 小红书 / 视频号 / 网页"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
      />
      <input
        name="title"
        placeholder="标题，可选"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
      />
      <textarea
        name="supplementalText"
        rows={8}
        placeholder="补充文案，可选。可以粘贴转写文本、正文、分享文案、评论或相关说明；有错别字也可以，系统会先尝试清洗理解。"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white">
          创建研究项目
        </button>
        {message ? <span className="text-sm text-rose-700">{message}</span> : null}
      </div>
    </form>
  );
}
