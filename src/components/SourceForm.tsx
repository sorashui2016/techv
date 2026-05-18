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
    <form action={submit} className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 md:grid-cols-7">
      <input
        name="name"
        placeholder="来源名称（可空，自动识别）"
        className="h-9 rounded-md border border-zinc-200 px-3 text-sm md:col-span-1"
      />
      <input
        name="urls"
        required
        placeholder="粘贴一个或多个 YouTube 频道链接"
        className="h-9 rounded-md border border-zinc-200 px-3 text-sm md:col-span-3"
      />
      <select name="platform" defaultValue="YOUTUBE" className="h-9 rounded-md border border-zinc-200 px-3 text-sm">
        <option value="YOUTUBE">YouTube</option>
        <option value="INSTAGRAM">Instagram</option>
        <option value="RSS">RSS</option>
        <option value="WEB">网页</option>
      </select>
      <select name="tier" defaultValue="NORMAL" className="h-9 rounded-md border border-zinc-200 px-3 text-sm">
        <option value="NORMAL">普通账号</option>
        <option value="IMPORTANT">重要账号</option>
      </select>
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "识别中" : "批量新增"}
      </button>
    </form>
  );
}
