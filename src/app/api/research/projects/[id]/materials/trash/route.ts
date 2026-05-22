import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.researchMaterial.deleteMany({
    where: {
      projectId: id,
      status: "REJECTED",
    },
  });
  return NextResponse.json({ deleted: result.count });
}
