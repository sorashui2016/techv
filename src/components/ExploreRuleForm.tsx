"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExploreRuleType, Platform } from "@prisma/client";

const ruleTypes: Array<{ value: ExploreRuleType; label: string }> = [
  { value: "SEARCH", label: "搜索关键词" },
  { value: "BOOST", label: "加分关键词" },
  { value: "DEMOTE", label: "降权关键词" },
  { value: "EXCLUDE", label: "排除关键词" },
  { value: "AUTHORITY", label: "权威来源关键词" },
];

export function ExploreRuleForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMessage(null);
    const body = {
      keyword: String(formData.get("keyword") ?? ""),
      type: String(formData.get("type") ?? "SEARCH") as ExploreRuleType,
      category: String(formData.get("category") ?? ""),
      weight: Number(formData.get("weight") ?? 1),
      platform: String(formData.get("platform") ?? "YOUTUBE") as Platform,
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch("/api/explore/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "新增规则失败");
      return;
    }
    setMessage("规则已新增");
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1.2fr_150px_140px_90px_120px_1fr_auto]">
      <input name="keyword" required placeholder="关键词" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
      <select name="type" defaultValue="SEARCH" className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
        {ruleTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <input name="category" required placeholder="分类标签" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
      <input name="weight" type="number" min="1" max="10" defaultValue="3" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
      <select name="platform" defaultValue="YOUTUBE" className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
        <option value="YOUTUBE">YouTube</option>
      </select>
      <input name="notes" placeholder="备注" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
      <button className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white">新增</button>
      {message ? <p className="text-sm text-zinc-600 md:col-span-7">{message}</p> : null}
    </form>
  );
}
