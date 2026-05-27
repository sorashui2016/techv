import { NextResponse } from "next/server";
import { downloadRadarMaterialPool } from "@/lib/research";

export async function POST() {
  try {
    const result = await downloadRadarMaterialPool();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "素材池下载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
