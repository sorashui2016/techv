import Image from "next/image";
import Link from "next/link";
import type { DecisionStatus, ExploreCandidateStatus, Prisma } from "@prisma/client";
import { ClearRejectedVideosButton } from "@/components/ClearRejectedVideosButton";
import { DashboardFilters } from "@/components/DashboardFilters";
import { ExploreCandidateActions } from "@/components/ExploreCandidateActions";
import { MaterialPoolDownloadButton } from "@/components/MaterialPoolDownloadButton";
import { Nav } from "@/components/Nav";
import { SubmitLinkForm } from "@/components/SubmitLinkForm";
import { VideoActions } from "@/components/VideoActions";
import { VideoOpenLink } from "@/components/VideoOpenLink";
import { decisionLabels, platformLabels, viewLabels } from "@/lib/labels";
import { isKnownPrismaConnectionError } from "@/lib/monitor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type VideoRow = Prisma.VideoItemGetPayload<{ include: { source: true } }>;
type ExploreRow = Prisma.ExploreCandidateGetPayload<object>;

type SearchParams = Promise<{
  status?: string;
  platform?: string;
  q?: string;
}>;

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

const sharedPoolStatuses = new Set(["CANDIDATE", "DONE", "PENDING", "MATERIAL", "REJECTED"]);

function isSharedPoolStatus(status: string): status is DecisionStatus & ExploreCandidateStatus {
  return sharedPoolStatuses.has(status);
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedStatus = params.status ?? "UNMARKED";

  let videos: VideoRow[] = [];
  let exploreCandidates: ExploreRow[] = [];
  let dbError = false;
  const showUnifiedPool = isSharedPoolStatus(selectedStatus);

  try {
    [videos, exploreCandidates] = await Promise.all([
      prisma.videoItem.findMany({
        include: { source: true },
        where: {
          researchProjects: { none: {} },
          decisionStatus:
            selectedStatus !== "ALL" ? (selectedStatus as DecisionStatus) : undefined,
          platform: params.platform && params.platform !== "ALL" ? (params.platform as never) : undefined,
          OR: params.q
            ? [
                { originalTitle: { contains: params.q, mode: "insensitive" } },
                { chineseTitle: { contains: params.q, mode: "insensitive" } },
                { sourceName: { contains: params.q, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: [{ source: { tier: "desc" } }, { detectedAt: "desc" }],
        take: 80,
      }),
      showUnifiedPool
        ? prisma.exploreCandidate.findMany({
            where: {
              status: selectedStatus as ExploreCandidateStatus,
              platform: params.platform && params.platform !== "ALL" ? (params.platform as never) : undefined,
              OR: params.q
                ? [
                    { originalTitle: { contains: params.q, mode: "insensitive" } },
                    { chineseTitle: { contains: params.q, mode: "insensitive" } },
                    { sourceName: { contains: params.q, mode: "insensitive" } },
                  ]
                : undefined,
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 80,
          })
        : Promise.resolve([]),
    ]);
  } catch (error) {
    if (isKnownPrismaConnectionError(error)) dbError = true;
    else throw error;
  }

  // Server render needs the current timestamp to fold week-old radar items.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">雷达 Dashboard</h1>
              <p className="mt-1 text-sm text-zinc-600">
                按监测时间倒序展示；点过原始链接即算已看，已看未标记会变灰。
              </p>
            </div>
            <Link href="/sources" className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">
              管理信息源
            </Link>
          </div>

          <SubmitLinkForm />

          <DashboardFilters>
            <select name="status" defaultValue={selectedStatus} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
              <option value="UNMARKED">未标记</option>
              <option value="ALL">全部状态</option>
              {Object.entries(decisionLabels).map(([value, label]) => (
                value === "UNMARKED" ? null : <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select name="platform" defaultValue={params.platform ?? "ALL"} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
              <option value="ALL">全部平台</option>
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input name="q" defaultValue={params.q ?? ""} placeholder="关键词搜索" className="rounded-md border border-zinc-200 px-3 py-2 text-sm" />
            <button className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white">筛选</button>
          </DashboardFilters>

          {selectedStatus === "REJECTED" && !dbError ? (
            <ClearRejectedVideosButton count={videos.length + exploreCandidates.length} />
          ) : null}
          {selectedStatus === "MATERIAL" && !dbError ? (
            <MaterialPoolDownloadButton endpoint="/api/materials/download" disabled={videos.length + exploreCandidates.length === 0} />
          ) : null}
        </section>

        {dbError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            还没有连上 PostgreSQL。等数据库装好后，复制 `.env.example` 为 `.env`，配置 `DATABASE_URL`，再运行 Prisma migration。
          </div>
        ) : null}

        {!dbError && videos.length + exploreCandidates.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            {selectedStatus === "UNMARKED"
              ? "当前没有待处理内容。可以先手动提交视频链接，或到信息源页面添加 YouTube 频道。"
              : "当前状态池没有内容。"}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          {exploreCandidates.map((candidate) => (
            <article key={candidate.id} className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">
                  探索 · {platformLabels[candidate.platform]}
                </span>
                <span className="rounded bg-lime-50 px-2 py-1 font-medium text-lime-800">
                  {candidate.score} 分
                </span>
                <span className="rounded bg-zinc-200 px-2 py-1 font-medium text-zinc-700">
                  {decisionLabels[candidate.status as DecisionStatus]}
                </span>
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
                  <p className="text-sm leading-6 text-zinc-700">{candidate.chineseSummary}</p>
                  <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
                    <span>来源：{candidate.sourceName}</span>
                    <span>发布时间：{dateText(candidate.publishedAt)}</span>
                    <span>观看：{candidate.viewCount ?? "未知"}</span>
                    <span>发现：{dateText(candidate.discoveredAt)}</span>
                  </div>
                  <ExploreCandidateActions candidateId={candidate.id} currentStatus={candidate.status} />
                </div>
              </div>
            </article>
          ))}
          {videos.map((video) => {
            const isOld = now - video.detectedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
            const isViewedUnmarked =
              video.viewState === "VIEWED" && video.decisionStatus === "UNMARKED";
            const isImportant = video.source?.tier === "IMPORTANT";
            const cardClass = isViewedUnmarked
              ? "border-zinc-300 bg-zinc-200 text-zinc-500"
              : isImportant
                ? "border-emerald-200 bg-emerald-50"
                : "border-zinc-200 bg-white";
            const mutedTextClass = isViewedUnmarked ? "text-zinc-500" : "text-zinc-700";
            const faintTextClass = isViewedUnmarked ? "text-zinc-400" : "text-zinc-500";

            return (
              <details
                key={video.id}
                open={!isOld}
                className={`rounded-lg border p-4 ${cardClass}`}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">
                          {platformLabels[video.platform]}
                        </span>
                        <span className="rounded bg-lime-50 px-2 py-1 font-medium text-lime-800">
                          {video.score} 分
                        </span>
                        <span className="rounded bg-zinc-200 px-2 py-1 font-medium text-zinc-700">
                          {viewLabels[video.viewState]} · {decisionLabels[video.decisionStatus]}
                        </span>
                      </div>
                      <VideoOpenLink
                        videoId={video.id}
                        originalUrl={video.originalUrl}
                        className={`mt-3 block text-left text-base font-semibold leading-6 ${
                          isViewedUnmarked ? "text-zinc-500 hover:text-zinc-600" : "hover:text-teal-700"
                        }`}
                      >
                        {video.chineseTitle ?? video.originalTitle}
                      </VideoOpenLink>
                    </div>
                    {isOld ? <span className="text-xs text-zinc-500">7 天前内容</span> : null}
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
                  <VideoOpenLink
                    videoId={video.id}
                    originalUrl={video.originalUrl}
                    className="relative aspect-video overflow-hidden rounded-md bg-zinc-200"
                  >
                    {video.thumbnailUrl ? (
                      <Image src={video.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                    ) : null}
                  </VideoOpenLink>
                  <div className="flex flex-col gap-3">
                    <VideoOpenLink
                      videoId={video.id}
                      originalUrl={video.originalUrl}
                      className={`text-left text-sm hover:text-teal-700 ${faintTextClass}`}
                    >
                      {video.originalTitle}
                    </VideoOpenLink>
                    <VideoOpenLink
                      videoId={video.id}
                      originalUrl={video.originalUrl}
                      className={`text-left text-sm leading-6 hover:text-teal-700 ${mutedTextClass}`}
                    >
                      {video.chineseSummary}
                    </VideoOpenLink>
                    <div className={`grid gap-1 text-xs sm:grid-cols-2 ${faintTextClass}`}>
                      <span>来源：{video.sourceName}</span>
                      <span>发布时间：{dateText(video.publishedAt)}</span>
                      <span>点赞：{video.likeCount ?? "未知"}</span>
                      <span>监测：{dateText(video.detectedAt)}</span>
                    </div>
                    {isViewedUnmarked ? (
                      <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-500">
                        已看过，待标记。
                      </p>
                    ) : null}
                    <VideoActions
                      videoId={video.id}
                      currentStatus={video.decisionStatus}
                    />
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      </main>
    </>
  );
}
