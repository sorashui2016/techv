"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function parseUrls(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return Array.from(
    new Set(
      value
        .split(/[\s,，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function SourceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    const urls = parseUrls(formData.get("urls"));
    if (urls.length === 0) return;

    setBusy(true);
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        urls,
        platform: formData.get("platform"),
        tier: formData.get("tier"),
      }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-6">
      <input
        name="name"
        placeholder="来源名称（可空，自动识别）"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-1"
      />
      <textarea
        name="urls"
        required
        rows={3}
        placeholder="粘贴一个或多个 YouTube 频道链接，每行一个"
        className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
      />
      <select name="platform" defaultValue="YOUTUBE" className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
        <option value="YOUTUBE">YouTube</option>
        <option value="INSTAGRAM">Instagram</option>
        <option value="RSS">RSS</option>
        <option value="WEB">网页</option>
      </select>
      <select name="tier" defaultValue="NORMAL" className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
        <option value="NORMAL">普通账号</option>
        <option value="IMPORTANT">重要账号</option>
      </select>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "识别中" : "批量新增"}
      </button>
    </form>
  );
}
