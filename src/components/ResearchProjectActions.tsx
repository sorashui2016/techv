"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchProjectStatus } from "@prisma/client";

const statusActions: Array<{ status: ResearchProjectStatus; label: string }> = [
  { status: "WORTH_DOING", label: "值得做" },
  { status: "PENDING", label: "待定" },
  { status: "NOT_DOING", label: "暂不做" },
];

export function ResearchProjectActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runResearch() {
    setIsRunning(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/research/projects/${projectId}/run`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "研究失败");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "研究失败");
    } finally {
      setIsRunning(false);
    }
  }

  async function patchStatus(status: ResearchProjectStatus) {
    await fetch(`/api/research/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function materialPlaceholder() {
    await fetch(`/api/research/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialStatus: "READY_TO_SEARCH" }),
    });
    setMessage("素材搜索已标记为准备状态，自动素材搜索将在后续版本实现。");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runResearch}
        disabled={isRunning}
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
      >
        {isRunning ? "研究中..." : "开始/重新研究"}
      </button>
      {statusActions.map((action) => (
        <button
          key={action.status}
          type="button"
          onClick={() => patchStatus(action.status)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {action.label}
        </button>
      ))}
      <button
        type="button"
        onClick={materialPlaceholder}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        搜索素材
      </button>
      {message ? <span className="text-sm text-zinc-600">{message}</span> : null}
    </div>
  );
}
