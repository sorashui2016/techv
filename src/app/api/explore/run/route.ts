import { NextResponse } from "next/server";
import { runExploreSearch } from "@/lib/explore";

export async function POST() {
  try {
    const result = await runExploreSearch();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explore run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
