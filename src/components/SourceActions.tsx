"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceStatus } from "@prisma/client";

export function SourceActions({ sourceId, status }: { sourceId: string; status: SourceStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(nextStatus: SourceStatus) {
    setBusy("status");
    await fetch(`/api/sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setBusy(null);
    router.refresh();
  }

  async function monitor() {
    setBusy("monitor");
    await fetch(`/api/sources/${sourceId}/monitor`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm("确定删除这个信息源吗？")) return;
    setBusy("delete");
    await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={monitor}
        disabled={busy !== null}
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        手动监测
      </button>
      <button
        type="button"
        onClick={() => patch(status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
        disabled={busy !== null}
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {status === "ACTIVE" ? "禁用" : "启用"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        删除
      </button>
    </div>
  );
}
