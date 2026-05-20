import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  status: z
    .enum(["REVIEW_PENDING", "THEME_CONFIRMED", "WORTH_DOING", "PENDING", "NOT_DOING", "TODO"])
    .optional(),
  materialStatus: z.enum(["NOT_STARTED", "READY_TO_SEARCH"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = schema.parse(await request.json());
  const project = await prisma.researchProject.update({ where: { id }, data: body });
  return NextResponse.json(project);
}
