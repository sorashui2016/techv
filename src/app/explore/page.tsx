import Image from "next/image";
import Link from "next/link";
import type { DecisionStatus, ExploreCandidate, ExploreCandidateStatus, Prisma } from "@prisma/client";
import { ExploreCandidateActions } from "@/components/ExploreCandidateActions";
import { ExploreRunButton } from "@/components/ExploreRunButton";
import { MaterialPoolDownloadButton } from "@/components/MaterialPoolDownloadButton";
import { Nav } from "@/components/Nav";
import { VideoActions } from "@/components/VideoActions";
import { exploreCandidateQualityWhere } from "@/lib/explore-config";
import { ensureDefaultExploreRules } from "@/lib/explore";
import { decisionLabels, platformLabels } from "@/lib/labels";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CandidateRow = Prisma.ExploreCandidateGetPayload<object>;
type RadarVideoRow = Prisma.VideoItemGetPayload<{ include: { source: true } }>;
type SearchParams = Promise<{
  status?: string;
}>;

const exploreStatusLabels: Record<ExploreCandidateStatus | "ALL", string> = {
  ALL: "全部状态",
  UNMARKED: "未标记",
  CANDIDATE: "备选",
  DONE: "已做",
  PENDING: "待定",
  MATERIAL: "素材",
  REJECTED: "不做",
  RESEARCH: "研究",
};

const sharedPoolStatuses = new Set(["CANDIDATE", "DONE", "PENDING", "MATERIAL", "REJECTED"]);

function isSharedPoolStatus(status: string): status is DecisionStatus & ExploreCandidateStatus {
  return sharedPoolStatuses.has(status);
}

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

function aggregationSources(value: ExploreCandidate["matchedRules"]) {
  if (!Array.isArray(value)) return [];
  const aggregation = value.find((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      "kind" in item &&
      (item as { kind?: unknown }).kind === "topicAggregation"
    );
  }) as { sources?: Array<{ url?: string; title?: string; sourceName?: string }> } | undefined;

  return Array.isArray(aggregation?.sources) ? aggregation.sources.filter((source) => source.url) : [];
}

function recentContentWhere(status: string) {
  return {
    ...exploreCandidateQualityWhere(),
    status:
      status === "ALL"
        ? undefined
        : status === "UNMARKED" ||
            status === "CANDIDATE" ||
            status === "DONE" ||
            status === "PENDING" ||
            status === "MATERIAL" ||
            status === "REJECTED" ||
            status === "RESEARCH"
          ? (status as ExploreCandidateStatus)
          : "UNMARKED",
  };
}

function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  const tags = jsonArray(candidate.tags);
  const sources = aggregationSources(candidate.matchedRules);

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
          {sources.length > 1 ? (
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
              <p className="font-medium text-zinc-800">Aggregated from {sources.length} signals</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.slice(0, 4).map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-zinc-100 px-2 py-1 hover:bg-teal-50 hover:text-teal-700"
                  >
                    {source.sourceName ?? source.title ?? "source"}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <ExploreCandidateActions candidateId={candidate.id} currentStatus={candidate.status} />
        </div>
      </div>
    </article>
  );
}

function RadarVideoCard({ video }: { video: RadarVideoRow }) {
  return (
    <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">
          雷达 · {platformLabels[video.platform]}
        </span>
        <span className="rounded bg-lime-50 px-2 py-1 font-medium text-lime-800">{video.score} 分</span>
        <span className="rounded bg-zinc-200 px-2 py-1 font-medium text-zinc-700">
          {decisionLabels[video.decisionStatus]}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
        <a
          href={video.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="relative aspect-video overflow-hidden rounded-md bg-zinc-200"
        >
          {video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt="" fill className="object-cover" unoptimized /> : null}
        </a>
        <div className="flex flex-col gap-3">
          <a
            href={video.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold leading-6 text-zinc-950 hover:text-teal-700"
          >
            {video.chineseTitle ?? video.originalTitle}
          </a>
          <p className="text-sm leading-6 text-zinc-700">{video.chineseSummary}</p>
          <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
            <span>来源：{video.sourceName}</span>
            <span>发布时间：{dateText(video.publishedAt)}</span>
            <span>点赞：{video.likeCount ?? "未知"}</span>
            <span>监测：{dateText(video.detectedAt)}</span>
          </div>
          <VideoActions videoId={video.id} currentStatus={video.decisionStatus} />
        </div>
      </div>
    </article>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedStatus = params.status ?? "UNMARKED";
  const showUnifiedPool = isSharedPoolStatus(selectedStatus);
  await ensureDefaultExploreRules();
  const [todayPicks, recentCandidates, radarVideos, lastRun] = await Promise.all([
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
    showUnifiedPool
      ? prisma.videoItem.findMany({
          include: { source: true },
          where: {
            researchProjects: { none: {} },
            decisionStatus: selectedStatus as DecisionStatus,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
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

        {selectedStatus === "MATERIAL" ? (
          <MaterialPoolDownloadButton
            endpoint="/api/materials/download"
            disabled={todayPicks.length + recentCandidates.length + radarVideos.length === 0}
          />
        ) : null}

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
          <h2 className="text-lg font-semibold">{showUnifiedPool ? "统一状态池" : "最近探索候选内容"}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {radarVideos.map((video) => (
              <RadarVideoCard key={video.id} video={video} />
            ))}
            {recentCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
