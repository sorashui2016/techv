import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { inferSourceName } from "@/lib/yt-dlp";

const schema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().min(1).optional(),
  ),
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  platform: z.enum(["YOUTUBE", "RSS", "WEB", "INSTAGRAM", "TIKTOK"]),
  tier: z.enum(["NORMAL", "IMPORTANT"]),
  notes: z.string().optional(),
});

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const urls = uniqueValues([...(body.urls ?? []), ...(body.url ? [body.url] : [])]);

  if (urls.length === 0) {
    return NextResponse.json({ error: "At least one source URL is required." }, { status: 400 });
  }

  const results = [];
  for (const url of urls) {
    const existing = await prisma.source.findUnique({ where: { url } });
    if (existing) {
      results.push({ url, status: "skipped", source: existing });
      continue;
    }

    const source = await prisma.source.create({
      data: {
        name: urls.length === 1 && body.name ? body.name : await inferSourceName(url),
        url,
        platform: body.platform,
        tier: body.tier,
        notes: body.notes,
      },
    });
    results.push({ url, status: "created", source });
  }

  return NextResponse.json({
    createdCount: results.filter((result) => result.status === "created").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    results,
  });
}
