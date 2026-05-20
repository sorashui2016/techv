"use client";

import { useRouter } from "next/navigation";
import type { DecisionStatus } from "@prisma/client";

const decisions: Array<{ value: DecisionStatus; label: string }> = [
  { value: "CANDIDATE", label: "备选" },
  { value: "DONE", label: "已做" },
  { value: "PENDING", label: "待定" },
  { value: "MATERIAL", label: "素材" },
  { value: "REJECTED", label: "不做" },
];

export function VideoActions({
  videoId,
  currentStatus,
}: {
  videoId: string;
  currentStatus: DecisionStatus;
}) {
  const router = useRouter();

  async function setDecision(decisionStatus: DecisionStatus) {
    await fetch(`/api/videos/${videoId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionStatus }),
    });
    router.refresh();
  }

  async function createResearchTask() {
    const response = await fetch(`/api/videos/${videoId}/research`, { method: "POST" });
    const data = await response.json();
    router.push(`/research/${data.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {decisions.map((decision) => (
        <button
          type="button"
          key={decision.value}
          onClick={() => setDecision(decision.value)}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            currentStatus === decision.value
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {decision.label}
        </button>
      ))}
      <button
        type="button"
        onClick={createResearchTask}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        研究
      </button>
    </div>
  );
}
