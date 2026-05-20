"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExploreRunButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runExplore() {
    setIsRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/explore/run", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "探索搜索失败");
      setMessage(`完成：搜索 ${data.searchedRuleCount} 条规则，新入库 ${data.newCandidateCount} 条`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "探索搜索失败");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={runExplore}
        disabled={isRunning}
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isRunning ? "正在探索..." : "立即执行探索搜索"}
      </button>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </div>
  );
}
