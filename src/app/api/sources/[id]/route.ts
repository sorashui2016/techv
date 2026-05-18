import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]).optional(),
  tier: z.enum(["NORMAL", "IMPORTANT"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = patchSchema.parse(await request.json());
  const source = await prisma.source.update({ where: { id }, data });
  return NextResponse.json(source);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
