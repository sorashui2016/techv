import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  status: z.enum(["CANDIDATE", "SELECTED", "NEEDS_LICENSE_CHECK", "DOWNLOADING", "DOWNLOADED", "FAILED", "REJECTED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = schema.parse(await request.json());
  const material = await prisma.researchMaterial.update({
    where: { id },
    data: body,
  });
  return NextResponse.json(material);
}
