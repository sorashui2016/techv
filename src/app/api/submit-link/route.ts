import { NextResponse } from "next/server";
import { z } from "zod";
import { submitVideoLink } from "@/lib/monitor";

const schema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  const { url } = schema.parse(await request.json());
  const result = await submitVideoLink(url);
  return NextResponse.json(result);
}
