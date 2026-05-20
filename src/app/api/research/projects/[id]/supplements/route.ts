import { NextResponse } from "next/server";
import { z } from "zod";
import { addResearchSupplement } from "@/lib/research";

const schema = z.object({
  type: z.enum(["TITLE", "BODY", "SHARE_TEXT", "COMMENT", "TRANSCRIPT", "SUBTITLE", "LINK", "NOTE"]),
  content: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = schema.parse(await request.json());
  const project = await addResearchSupplement(id, body.type, body.content, body.notes);
  return NextResponse.json(project);
}
