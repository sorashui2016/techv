import Image from "next/image";
import Link from "next/link";
import type { ExploreCandidate } from "@prisma/client";
import { ExploreCandidateActions } from "@/components/ExploreCandidateActions";
import { Nav } from "@/components/Nav";
import { getNextExploreCandidate } from "@/lib/explore";

export const dynamic = "force-dynamic";

function dateText(date?: Date | null) {
  if (!date) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function jsonArray(value: ExploreCandidate["tags"]) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function ExploreNextPage() {
  const candidate = await getNextExploreCandidate();

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold">探索下一条</h1>
            <p className="mt-1 text-sm text-zinc-600">每次只判断一条，明确“不做”的内容不会反复出现。</p>
          </div>
          <Link href="/explore" className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">
            返回探索首页
          </Link>
        </div>

        {!candidate ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            当前没有未标记的探索候选内容。可以先回探索首页执行一次搜索。
          </div>
        ) : (
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">{candidate.platform}</span>
              <span className="rounded bg-lime-50 px-2 py-1 font-medium text-lime-800">{candidate.score} 分</span>
              <span className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-700">{candidate.sourceType ?? "平台搜索"}</span>
            </div>
            <a
              href={candidate.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-xl font-semibold leading-8 text-zinc-950 hover:text-teal-700"
            >
              {candidate.chineseTitle ?? candidate.originalTitle}
            </a>
            <a
              href={candidate.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm text-zinc-500 hover:text-teal-700"
            >
              {candidate.originalTitle}
            </a>
            <a
              href={candidate.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="relative mt-5 block aspect-video overflow-hidden rounded-md bg-zinc-200"
            >
              {candidate.thumbnailUrl ? (
                <Image src={candidate.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
              ) : null}
            </a>
            <p className="mt-5 text-sm leading-6 text-zinc-700">{candidate.chineseSummary}</p>
            <div className="mt-4 grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
              <span>来源：{candidate.sourceName}</span>
              <span>发布：{dateText(candidate.publishedAt)}</span>
              <span>观看：{candidate.viewCount ?? "未知"}</span>
              <span>点赞：{candidate.likeCount ?? "未知"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {jsonArray(candidate.tags).map((tag) => (
                <span key={tag} className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>
            {candidate.recommendationReason ? (
              <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {candidate.recommendationReason}
              </p>
            ) : null}
            <div className="mt-5">
              <ExploreCandidateActions candidateId={candidate.id} currentStatus={candidate.status} showNext />
            </div>
          </article>
        )}
      </main>
    </>
  );
}
