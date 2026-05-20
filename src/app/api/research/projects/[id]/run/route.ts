import { NextResponse } from "next/server";
import { runResearchProject } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const project = await runResearchProject(id);
    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "研究失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
