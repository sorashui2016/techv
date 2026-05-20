import { NextResponse } from "next/server";
import { confirmResearchReportVersion } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const project = await confirmResearchReportVersion(id);
    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "确认主题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
