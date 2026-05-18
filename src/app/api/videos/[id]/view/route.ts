import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.videoItem.update({
    where: { id },
    data: { viewState: "VIEWED", viewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
