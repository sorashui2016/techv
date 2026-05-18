import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { inferSourceMetadata, SourceNameInferenceError } from "@/lib/yt-dlp";

const patchSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().min(1).optional(),
  ),
  url: z.string().url().optional(),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]).optional(),
  tier: z.enum(["NORMAL", "IMPORTANT"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = patchSchema.parse(await request.json());
  const updateData: Prisma.SourceUpdateInput = { ...data };

  if (data.url) {
    try {
      const metadata = await inferSourceMetadata(data.url, { strict: true });
      const existing = await prisma.source.findFirst({
        where: {
          NOT: { id },
          OR: [{ url: data.url }, { sourceKey: metadata.sourceKey }],
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json({ error: "这个账号已经在信息源里了。" }, { status: 409 });
      }

      updateData.name = data.name ?? metadata.name;
      updateData.sourceKey = metadata.sourceKey;
      updateData.lastCheckStatus = null;
      updateData.lastCheckError = null;
      updateData.lastCheckedAt = null;
    } catch (error) {
      if (error instanceof SourceNameInferenceError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const source = await prisma.source.update({ where: { id }, data: updateData });
  return NextResponse.json(source);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
