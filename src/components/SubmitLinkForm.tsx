"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitLinkForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    await fetch("/api/submit-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: formData.get("url") }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="url"
        required
        placeholder="手动提交 YouTube / Instagram / TikTok 视频链接"
        className="min-w-0 flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "处理中" : "提交"}
      </button>
    </form>
  );
}
