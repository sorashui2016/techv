import { NextResponse } from "next/server";
import { monitorAllSources, monitorDueSources } from "@/lib/monitor";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mode = body && typeof body === "object" && "mode" in body ? body.mode : "due";
  const results = mode === "all" ? await monitorAllSources() : await monitorDueSources();
  return NextResponse.json({ mode, results });
}
