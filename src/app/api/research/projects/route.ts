import { NextResponse } from "next/server";
import { z } from "zod";
import { createResearchProject, detectResearchPlatform } from "@/lib/research";

const schema = z.object({
  originalUrl: z.string().url(),
  title: z.string().trim().optional(),
  supplementalText: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const project = await createResearchProject({
    entryType: "MANUAL_LINK",
    originalUrl: body.originalUrl,
    platform: detectResearchPlatform(body.originalUrl),
    title: body.title,
    supplementalText: body.supplementalText,
  });

  return NextResponse.json(project);
}
