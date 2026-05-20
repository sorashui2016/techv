import { NextResponse } from "next/server";
import { createResearchProjectFromExploreCandidate } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await createResearchProjectFromExploreCandidate(id);
  return NextResponse.json(project);
}
