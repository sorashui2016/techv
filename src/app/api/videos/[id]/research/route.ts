import { NextResponse } from "next/server";
import { createResearchProjectFromVideo } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await createResearchProjectFromVideo(id);
  return NextResponse.json(project);
}
