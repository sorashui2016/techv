"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchMaterialItemStatus } from "@prisma/client";

export function ResearchMaterialActions({
  materialId,
  status,
}: {
  materialId: string;
  status: ResearchMaterialItemStatus;
}) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const isAlreadyDownloaded = status === "DOWNLOADED";
  const isDownloadLocked = status === "DOWNLOADING";

  async function patchStatus(status: ResearchMaterialItemStatus) {
    await fetch(`/api/research/materials/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function downloadMaterial() {
    setIsDownloading(true);
    try {
      await fetch(`/api/research/materials/${materialId}/download`, { method: "POST" });
      router.refresh();
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={downloadMaterial}
        disabled={isDownloading || isDownloadLocked}
        className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:text-teal-500"
      >
        {isDownloading || status === "DOWNLOADING" ? "下载中..." : isAlreadyDownloaded ? "重新下载" : "下载"}
      </button>
      <button
        type="button"
        onClick={() => patchStatus("REJECTED")}
        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        不用
      </button>
    </div>
  );
}
