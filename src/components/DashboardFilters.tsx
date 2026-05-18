"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

export function DashboardFilters({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 md:grid-cols-4"
    >
      <div onChange={submit} className="contents">
        {children}
      </div>
    </form>
  );
}
