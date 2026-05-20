import Image from "next/image";
import Link from "next/link";
import type { ExploreCandidate, ExploreCandidateStatus, Prisma } from "@prisma/client";
import { ExploreCandidateActions } from "@/components/ExploreCandidateActions";
import { ExploreRunButton } from "@/components/ExploreRunButton";
import { Nav } from "@/components/Nav";
import { ensureDefaultExploreRules } from "@/lib/explore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CandidateRow = Prisma.ExploreCandidateGetPayload<object>;
type SearchParams = Promise<{
  status?: string;
}>;

const exploreStatusLabels: Record<ExploreCandidateStatus | "ALL", string> = {
  ALL: "全部状态",
  UNMARKED: "未标记",
  CANDIDATE: "备选",
  PENDING: "待定",
  MATERIAL: "素材",
  REJECTED: "不做",
  RESEARCH: "研究",
};

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

function recentContentWhere(status: string) {
  const cutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
  return {
    status:
      status === "ALL"
        ? undefined
        : status === "UNMARKED" ||
            status === "CANDIDATE" ||
            status === "PENDING" ||
            status === "MATERIAL" ||
            status === "REJECTED" ||
            status === "RESEARCH"
          ? (status as ExploreCandidateStatus)
          : "UNMARKED",
    OR: [{ publishedAt: null }, { publishedAt: { gte: cutoff } }],
  };
}

function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  const tags = jsonArray(candidate.tags);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">{candidate.platform}</span>
        <span className="rounded bg-lime-50 px-2 py-1 font-medium text-lime-800">{candidate.score} 分</span>
        <span className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
          {exploreStatusLabels[candidate.status]}
        </span>
        {candidate.isTodayPick ? (
          <span className="rounded bg-amber-50 px-2 py-1 font-medium text-amber-800">今日推荐</span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
        <a
          href={candidate.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="relative aspect-video overflow-hidden rounded-md bg-zinc-200"
        >
          {candidate.thumbnailUrl ? (
            <Image src={candidate.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
          ) : null}
        </a>
        <div className="flex flex-col gap-3">
          <a
            href={candidate.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold leading-6 text-zinc-950 hover:text-teal-700"
          >
            {candidate.chineseTitle ?? candidate.originalTitle}
          </a>
          <a
            href={candidate.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-zinc-500 hover:text-teal-700"
          >
            {candidate.originalTitle}
          </a>
          <p className="text-sm leading-6 text-zinc-700">{candidate.chineseSummary}</p>
          <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
            <span>来源：{candidate.sourceName}</span>
            <span>类型：{candidate.sourceType ?? "平台搜索"}</span>
            <span>发布：{dateText(candidate.publishedAt)}</span>
            <span>观看：{candidate.viewCount ?? "未知"}</span>
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {candidate.recommendationReason ? (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {candidate.recommendationReason}
            </p>
          ) : null}
          <ExploreCandidateActions candidateId={candidate.id} currentStatus={candidate.status} />
        </div>
      </div>
    </article>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedStatus = params.status ?? "UNMARKED";
  await ensureDefaultExploreRules();
  const [todayPicks, recentCandidates, lastRun] = await Promise.all([
    prisma.exploreCandidate.findMany({
      where: { isTodayPick: true, ...recentContentWhere(selectedStatus) },
      orderBy: [{ score: "desc" }, { discoveredAt: "desc" }],
      take: 10,
    }),
    prisma.exploreCandidate.findMany({
      where: recentContentWhere(selectedStatus),
      orderBy: [{ discoveredAt: "desc" }],
      take: 20,
    }),
    prisma.exploreRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold">探索雷达</h1>
            <p className="mt-1 text-sm text-zinc-600">
              主动搜索平台内容，生成科技发现候选池；账号监测仍在雷达首页独立运行。
            </p>
            {lastRun ? (
              <p className="mt-1 text-xs text-zinc-500">
                最近探索：{dateText(lastRun.startedAt)}，新入库 {lastRun.newCandidateCount} 条
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore/next" className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">
              探索下一条
            </Link>
            <Link href="/explore/rules" className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">
              规则管理
            </Link>
          </div>
        </section>

        <ExploreRunButton />

        <form className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
          <select name="status" defaultValue={selectedStatus} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
            {Object.entries(exploreStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white">查看池子</button>
        </form>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">今日科技发现 10 条</h2>
          {todayPicks.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
              还没有今日推荐。点击“立即执行探索搜索”后会生成。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {todayPicks.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">最近探索候选内容</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {recentCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
