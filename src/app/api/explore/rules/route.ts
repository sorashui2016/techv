import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  keyword: z.string().trim().min(1),
  type: z.enum(["SEARCH", "BOOST", "DEMOTE", "EXCLUDE", "AUTHORITY"]),
  category: z.string().trim().min(1),
  weight: z.number().int().min(1).max(10),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]).default("YOUTUBE"),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const existing = await prisma.exploreRule.findFirst({
    where: {
      keyword: { equals: body.keyword, mode: "insensitive" },
      type: body.type,
      platform: body.platform,
    },
  });

  if (existing) {
    return NextResponse.json({ error: "这条规则已经存在。" }, { status: 409 });
  }

  const rule = await prisma.exploreRule.create({ data: body });
  return NextResponse.json(rule);
}
