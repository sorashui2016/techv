import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { SubmitLinkForm } from "@/components/SubmitLinkForm";
import { VideoActions } from "@/components/VideoActions";
import { decisionLabels, platformLabels, viewLabels } from "@/lib/labels";
import { isKnownPrismaConnectionError } from "@/lib/monitor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type VideoRow = Prisma.VideoItemGetPayload<object>;

type SearchParams = Promise<{
  status?: string;
  platform?: string;
  q?: string;
}>;

function dateText(date?: Date | null) {
  if (!date) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  let videos: VideoRow[] = [];
  let dbError = false;

  try {
    videos = await prisma.videoItem.findMany({
      where: {
        decisionStatus:
          params.status && params.status !== "ALL" ? (params.status as never) : undefined,
        platform: params.platform && params.platform !== "ALL" ? (params.platform as never) : undefined,
        OR: params.q
          ? [
              { originalTitle: { contains: params.q, mode: "insensitive" } },
              { chineseTitle: { contains: params.q, mode: "insensitive" } },
              { sourceName: { contains: params.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { detectedAt: "desc" },
      take: 80,
    });
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

          <form className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 md:grid-cols-4">
            <select name="status" defaultValue={params.status ?? "ALL"} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
              <option value="ALL">全部状态</option>
              {Object.entries(decisionLabels).map(([value, label]) => (
                <option key={value} value={value}>
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
          </form>
        </section>

        {dbError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            还没有连上 PostgreSQL。等数据库装好后，复制 `.env.example` 为 `.env`，配置 `DATABASE_URL`，再运行 Prisma migration。
          </div>
        ) : null}

        {!dbError && videos.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            还没有监测内容。可以先手动提交视频链接，或到信息源页面添加 YouTube 频道。
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          {videos.map((video) => {
            const isOld = now - video.detectedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
            const isViewedUnmarked =
              video.viewState === "VIEWED" && video.decisionStatus === "UNMARKED";

            return (
              <details
                key={video.id}
                open={!isOld}
                className={`rounded-lg border p-4 ${
                  isViewedUnmarked
                    ? "border-zinc-200 bg-zinc-100"
                    : "border-zinc-200 bg-white"
                }`}
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
                      <h2 className="mt-3 text-base font-semibold leading-6">
                        {video.chineseTitle ?? video.originalTitle}
                      </h2>
                    </div>
                    {isOld ? <span className="text-xs text-zinc-500">7 天前内容</span> : null}
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-200">
                    {video.thumbnailUrl ? (
                      <Image src={video.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-zinc-500">{video.originalTitle}</p>
                    <p className="text-sm leading-6 text-zinc-700">{video.chineseSummary}</p>
                    <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
                      <span>来源：{video.sourceName}</span>
                      <span>发布时间：{dateText(video.publishedAt)}</span>
                      <span>点赞：{video.likeCount ?? "未知"}</span>
                      <span>监测：{dateText(video.detectedAt)}</span>
                    </div>
                    {isViewedUnmarked ? (
                      <p className="rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700">
                        已看过，待标记。
                      </p>
                    ) : null}
                    <VideoActions
                      videoId={video.id}
                      originalUrl={video.originalUrl}
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
