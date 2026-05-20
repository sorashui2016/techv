import { NextResponse } from "next/server";
import { z } from "zod";
import { iterateResearchProject } from "@/lib/research";

const schema = z.object({
  instruction: z.string().trim().min(1, "请填写继续研究的方向"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = schema.parse(await request.json());
    const project = await iterateResearchProject(id, body.instruction);
    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "继续研究失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
