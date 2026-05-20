import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  decisionStatus: z.enum(["UNMARKED", "CANDIDATE", "DONE", "PENDING", "MATERIAL", "REJECTED"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = schema.parse(await request.json());
  await prisma.videoItem.update({ where: { id }, data: body });
  return NextResponse.json({ ok: true });
}
