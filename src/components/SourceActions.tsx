"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceStatus, SourceTier } from "@prisma/client";

export function SourceActions({
  sourceId,
  status,
  tier,
  url,
  hasError,
}: {
  sourceId: string;
  status: SourceStatus;
  tier: SourceTier;
  url: string;
  hasError: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(
    data: { status?: SourceStatus; tier?: SourceTier; url?: string },
    busyKey: string,
  ) {
    setBusy(busyKey);
    const response = await fetch(`/api/sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(null);

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      alert(result?.error ?? "更新失败，请检查链接后重试。");
      return;
    }

    router.refresh();
  }

  async function monitor() {
    setBusy("monitor");
    await fetch(`/api/sources/${sourceId}/monitor`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function replaceUrl() {
    const nextUrl = prompt("粘贴正确的频道或账号链接：", url)?.trim();
    if (!nextUrl || nextUrl === url) return;
    await patch({ url: nextUrl }, "replace");
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
        onClick={() => patch({ status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" }, "status")}
        disabled={busy !== null}
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {status === "ACTIVE" ? "禁用" : "启用"}
      </button>
      <button
        type="button"
        onClick={() => patch({ tier: tier === "IMPORTANT" ? "NORMAL" : "IMPORTANT" }, "tier")}
        disabled={busy !== null}
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {tier === "IMPORTANT" ? "设为普通" : "设为重要"}
      </button>
      {hasError ? (
        <button
          type="button"
          onClick={replaceUrl}
          disabled={busy !== null}
          className="rounded-md border border-amber-300 px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-60"
        >
          替换链接
        </button>
      ) : null}
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
