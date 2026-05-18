import { NextResponse } from "next/server";
import { monitorDueSources } from "@/lib/monitor";

export async function POST() {
  const results = await monitorDueSources();
  return NextResponse.json({ results });
}
