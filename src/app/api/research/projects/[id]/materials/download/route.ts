import { NextResponse } from "next/server";
import { downloadResearchMaterials } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await downloadResearchMaterials(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "素材批量下载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
