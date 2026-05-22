import { NextResponse } from "next/server";
import { z } from "zod";
import { searchResearchMaterials } from "@/lib/research";

const schema = z.object({
  instruction: z.string().trim().max(300).optional(),
  mode: z.enum(["append", "replace"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const result = await searchResearchMaterials(id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "素材搜索失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
