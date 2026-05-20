import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const result = await prisma.videoItem.deleteMany({
    where: { decisionStatus: "REJECTED" },
  });

  return NextResponse.json({ deletedCount: result.count });
}
