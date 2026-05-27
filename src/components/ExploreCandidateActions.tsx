"use client";

import { useRouter } from "next/navigation";
import type { ExploreCandidateStatus } from "@prisma/client";

const decisions: Array<{ value: ExploreCandidateStatus; label: string }> = [
  { value: "CANDIDATE", label: "备选" },
  { value: "DONE", label: "已做" },
  { value: "PENDING", label: "待定" },
  { value: "MATERIAL", label: "素材" },
  { value: "REJECTED", label: "不做" },
];

export function ExploreCandidateActions({
  candidateId,
  currentStatus,
  showNext = false,
}: {
  candidateId: string;
  currentStatus: ExploreCandidateStatus;
  showNext?: boolean;
}) {
  const router = useRouter();

  async function setStatus(status: ExploreCandidateStatus) {
    await fetch(`/api/explore/candidates/${candidateId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function createResearchProject() {
    const response = await fetch(`/api/explore/candidates/${candidateId}/research`, { method: "POST" });
    const data = await response.json();
    router.push(`/research/${data.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={createResearchProject}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        研究
      </button>
      {decisions.map((decision) => (
        <button
          type="button"
          key={decision.value}
          onClick={() => setStatus(decision.value)}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            currentStatus === decision.value
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {decision.label}
        </button>
      ))}
      {showNext ? (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          下一条
        </button>
      ) : null}
    </div>
  );
}
