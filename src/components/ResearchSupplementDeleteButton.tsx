"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchSupplementDeleteButton({ supplementId }: { supplementId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove() {
    const confirmed = window.confirm("确定删除这条补充材料吗？");
    if (!confirmed) return;

    setIsDeleting(true);
    await fetch(`/api/research/supplements/${supplementId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isDeleting}
      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
    >
      {isDeleting ? "删除中" : "删除"}
    </button>
  );
}
