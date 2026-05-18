import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]),
  tier: z.enum(["NORMAL", "IMPORTANT"]),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const source = await prisma.source.create({ data: body });
  return NextResponse.json(source);
}
