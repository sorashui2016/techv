import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const radarResult = await prisma.videoItem.deleteMany({
    where: { decisionStatus: "REJECTED" },
  });
  const exploreResult = await prisma.exploreCandidate.deleteMany({
    where: { status: "REJECTED" },
  });

  return NextResponse.json({ deletedCount: radarResult.count + exploreResult.count });
}
