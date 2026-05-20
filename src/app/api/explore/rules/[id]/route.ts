import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  type: z.enum(["SEARCH", "BOOST", "DEMOTE", "EXCLUDE", "AUTHORITY"]).optional(),
  category: z.string().trim().min(1).optional(),
  weight: z.number().int().min(1).max(10).optional(),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  notes: z.string().trim().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = patchSchema.parse(await request.json());
  const rule = await prisma.exploreRule.update({ where: { id }, data: body });
  return NextResponse.json(rule);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.exploreRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
