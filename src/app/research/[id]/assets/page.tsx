import Link from "next/link";
import type { ResearchAssetStatus, ResearchAssetType } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { prisma } from "@/lib/db";
import type { VideoMediaInfo } from "@/lib/media-info";
import { readVideoMediaInfo } from "@/lib/media-info";

export const dynamic = "force-dynamic";

const assetTypeLabels: Record<ResearchAssetType, string> = {
  VIDEO: "视频",
  AUDIO: "音频",
  IMAGE: "图片",
  SUBTITLE: "字幕",
  TRANSCRIPT: "转写",
  KEYFRAME: "关键帧",
  OTHER: "其他",
};

const assetStatusLabels: Record<ResearchAssetStatus, string> = {
  SAVED: "已保存",
  FAILED: "失败",
  NEEDS_MANUAL_UPLOAD: "需要手动补充",
};

function dateText(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function durationText(seconds?: number) {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default async function ResearchAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.researchProject.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
    },
  });
  const videoInfoEntries: Array<[string, VideoMediaInfo | null]> = await Promise.all(
    (project?.assets ?? []).map(async (asset) => [
      asset.id,
      asset.type === "VIDEO" ? await readVideoMediaInfo(asset.localPath) : null,
    ]),
  );
  const videoInfoByAssetId = new Map(videoInfoEntries);

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
        <Link href={project ? `/research/${project.id}` : "/research"} className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回研究详情
        </Link>

        {!project ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            没有找到这个研究项目。
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">自动解析素材详情</h1>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {project.title ?? project.oneLineConclusion ?? "未命名研究项目"}
                  </p>
                </div>
                <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                  {project.assets.length} 条
                </span>
              </div>
              {project.projectFolderPath ? (
                <p className="mt-4 break-all rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  本地目录：{project.projectFolderPath}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              {project.assets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-zinc-200 text-xs text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">类型</th>
                        <th className="px-3 py-2">状态</th>
                        <th className="px-3 py-2">视频信息</th>
                        <th className="px-3 py-2">文件/说明</th>
                        <th className="px-3 py-2">来源</th>
                        <th className="px-3 py-2">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.assets.map((asset) => (
                        <tr key={asset.id} className="border-b border-zinc-100 last:border-b-0">
                          <td className="px-3 py-3">{assetTypeLabels[asset.type]}</td>
                          <td className="px-3 py-3">{assetStatusLabels[asset.status]}</td>
                          <td className="px-3 py-3 text-zinc-700">
                            {asset.type === "VIDEO" ? (
                              (() => {
                                const mediaInfo = videoInfoByAssetId.get(asset.id);
                                if (!mediaInfo) return <span className="text-zinc-400">未读取</span>;
                                if (mediaInfo.error) {
                                  return <span className="text-rose-700">{mediaInfo.error}</span>;
                                }
                                return (
                                  <div className="space-y-1">
                                    <div className="font-medium text-zinc-900">
                                      {mediaInfo.resolution ?? "分辨率未知"}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      {[mediaInfo.codec, durationText(mediaInfo.durationSeconds)].filter(Boolean).join(" / ") ||
                                        "无更多信息"}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="break-all text-zinc-800">
                              {asset.localPath ?? asset.title ?? "未保存本地文件"}
                            </div>
                            {asset.notes ? <div className="mt-1 text-xs text-zinc-500">{asset.notes}</div> : null}
                          </td>
                          <td className="px-3 py-3">
                            {asset.sourceUrl ? (
                              <a
                                href={asset.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-teal-700 hover:text-teal-900"
                              >
                                {asset.sourceUrl}
                              </a>
                            ) : (
                              <span className="text-zinc-400">无</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-zinc-500">{dateText(asset.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">还没有自动解析素材记录。</p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
