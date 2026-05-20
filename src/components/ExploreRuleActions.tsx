"use client";

import { useRouter } from "next/navigation";
import type { ExploreRuleStatus } from "@prisma/client";

export function ExploreRuleActions({
  ruleId,
  status,
}: {
  ruleId: string;
  status: ExploreRuleStatus;
}) {
  const router = useRouter();

  async function patch(nextStatus: ExploreRuleStatus) {
    await fetch(`/api/explore/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  }

  async function remove() {
    await fetch(`/api/explore/rules/${ruleId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => patch(status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        {status === "ACTIVE" ? "禁用" : "启用"}
      </button>
      <button
        type="button"
        onClick={remove}
        className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
      >
        删除
      </button>
    </div>
  );
}
