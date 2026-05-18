import { NextResponse } from "next/server";
import { monitorSource } from "@/lib/monitor";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await monitorSource(id);
  return NextResponse.json(result);
}
