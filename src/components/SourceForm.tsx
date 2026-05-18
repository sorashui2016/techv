"use client";

import { useRouter } from "next/navigation";
export function SourceForm() {
  const router = useRouter();

  async function submit(formData: FormData) {
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-6">
      <input
        name="name"
        required
        placeholder="来源名称"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-1"
      />
      <input
        name="url"
        required
        placeholder="频道或账号链接"
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
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
      <button type="submit" className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white">
        新增
      </button>
    </form>
  );
}
