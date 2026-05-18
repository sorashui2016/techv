import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.researchTask.findFirst({ where: { videoId: id } });
  if (existing) return NextResponse.json(existing);

  const task = await prisma.researchTask.create({ data: { videoId: id } });
  return NextResponse.json(task);
}
