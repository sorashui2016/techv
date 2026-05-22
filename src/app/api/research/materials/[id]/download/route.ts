import { NextResponse } from "next/server";
import { downloadResearchMaterial } from "@/lib/research";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const material = await downloadResearchMaterial(id);
    return NextResponse.json(material);
  } catch (error) {
    const message = error instanceof Error ? error.message : "素材下载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
