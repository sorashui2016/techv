"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

export function ResearchMaterialRestoreButton({ materialId }: { materialId: string }) {
  const router = useRouter();

  async function restore() {
    await fetch(`/api/research/materials/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANDIDATE" }),
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={restore}
      className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
    >
      恢复
    </button>
  );
}

export function ResearchMaterialEmptyTrashButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function emptyTrash(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm("确定清空素材垃圾箱吗？这会永久删除里面的素材候选记录。");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await fetch(`/api/research/projects/${projectId}/materials/trash`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={emptyTrash}
      disabled={disabled || isDeleting}
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:bg-zinc-100 disabled:text-zinc-400"
    >
      {isDeleting ? "清空中..." : "清空垃圾箱"}
    </button>
  );
}
