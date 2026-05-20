import Link from "next/link";
import type {
  ResearchAssetStatus,
  ResearchAssetType,
  ResearchMaterialStatus,
  ResearchProjectStatus,
  ResearchSupplementType,
} from "@prisma/client";
import { Nav } from "@/components/Nav";
import { ReportText } from "@/components/ReportText";
import { ResearchIterationForm } from "@/components/ResearchIterationForm";
import { ResearchProjectActions } from "@/components/ResearchProjectActions";
import { ResearchReportVersionActions } from "@/components/ResearchReportVersionActions";
import { ResearchSupplementDeleteButton } from "@/components/ResearchSupplementDeleteButton";
import { ResearchSupplementForm } from "@/components/ResearchSupplementForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusLabels: Record<ResearchProjectStatus, string> = {
  TODO: "待研究",
  PARSING: "链接解析中",
  NEEDS_SUPPLEMENT: "需要补充材料",
  SUPPLEMENT_SUBMITTED: "补充材料已提交",
  UNDERSTANDING: "内容理解中",
  SEARCHING_TEXT: "文字资料搜索中",
  WRITING_REPORT: "综述生成中",
  ITERATING: "继续研究中",
  REVIEW_PENDING: "已研究-待确认",
  THEME_CONFIRMED: "主题已确认",
  WORTH_DOING: "已研究-值得做",
  PENDING: "已研究-待定",
  NOT_DOING: "已研究-暂不做",
  FAILED: "研究失败",
};

const materialLabels: Record<ResearchMaterialStatus, string> = {
  NOT_STARTED: "素材未开始",
  READY_TO_SEARCH: "准备搜索素材",
  SEARCHING: "素材搜索中",
  DOWNLOADING: "素材下载中",
  TRANSCRIBING: "音频转写中",
  TRANSLATING: "翻译中",
  ORGANIZING: "素材整理中",
  COMPLETED: "素材已完成",
  PARTIAL: "素材部分完成",
  FAILED: "素材失败",
};

const supplementLabels: Record<ResearchSupplementType, string> = {
  TITLE: "标题",
  BODY: "正文",
  SHARE_TEXT: "分享文案",
  COMMENT: "评论",
  TRANSCRIPT: "转写文本",
  SUBTITLE: "字幕",
  LINK: "相关链接",
  NOTE: "备注",
};

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

function sourceList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as { title?: unknown; url?: unknown; type?: unknown };
      if (typeof source.url !== "string") return null;
      return {
        title: typeof source.title === "string" ? source.title : source.url,
        url: source.url,
        type: typeof source.type === "string" ? source.type : "source",
      };
    })
    .filter(Boolean) as Array<{ title: string; url: string; type: string }>;
}

export default async function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.researchProject.findUnique({
    where: { id },
    include: {
      sourceVideo: true,
      exploreCandidate: true,
      supplements: { orderBy: { createdAt: "desc" } },
      assets: { orderBy: { createdAt: "desc" } },
      reportVersions: { orderBy: { versionNumber: "desc" } },
    },
  });

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
        <Link href="/research" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回研究池
        </Link>

        {!project ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            没有找到这个研究项目。
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                  {statusLabels[project.status]}
                </span>
                <span className="rounded bg-cyan-50 px-2 py-1 font-medium text-cyan-800">
                  {project.platform ?? "未知平台"}
                </span>
                <span className="rounded bg-amber-50 px-2 py-1 font-medium text-amber-800">
                  {materialLabels[project.materialStatus]}
                </span>
                <span className="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
                  {project.entryType}
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-semibold">
                {project.title ?? project.oneLineConclusion ?? "未命名研究项目"}
              </h1>
              <a
                href={project.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-teal-700 hover:text-teal-900"
              >
                {project.originalUrl}
              </a>
              {project.summary ? <p className="mt-3 text-sm leading-6 text-zinc-700">{project.summary}</p> : null}
              {project.errorMessage ? (
                <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{project.errorMessage}</p>
              ) : null}
              <div className="mt-4">
                <ResearchProjectActions projectId={project.id} />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                创建：{dateText(project.createdAt)} · 更新：{dateText(project.updatedAt)}
              </p>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">继续研究 / 调整方向</h2>
              <p className="mt-1 text-sm text-zinc-600">
                看完当前报告后，可以把新想法写在这里，让系统生成新版报告。适合用来扩展成合集、收窄主题、增加对比对象或补查某个方向。
              </p>
              <div className="mt-4">
                <ResearchIterationForm projectId={project.id} />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">补充材料</h2>
              <p className="mt-1 text-sm text-zinc-600">
                小红书、视频号或自动解析不足时，可粘贴转写文本、字幕、正文、评论、分享文案或相关链接。文案有错别字也可以。
              </p>
              <div className="mt-4">
                <ResearchSupplementForm projectId={project.id} />
              </div>
              {project.supplements.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {project.supplements.map((supplement) => (
                    <div key={supplement.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium text-zinc-500">
                          {supplementLabels[supplement.type]} · {dateText(supplement.createdAt)}
                        </div>
                        <ResearchSupplementDeleteButton supplementId={supplement.id} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                        {supplement.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">自动解析素材</h2>
              <p className="mt-1 text-sm text-zinc-600">
                系统会尽力保存公开可解析的视频、字幕、音频和关键帧；无法自动获取时会留下需要手动补充的记录。
              </p>
              {project.assets.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-zinc-100 text-xs text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">类型</th>
                        <th className="px-3 py-2">状态</th>
                        <th className="px-3 py-2">文件/说明</th>
                        <th className="px-3 py-2">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.assets.map((asset) => (
                        <tr key={asset.id} className="border-t border-zinc-100">
                          <td className="px-3 py-2">{assetTypeLabels[asset.type]}</td>
                          <td className="px-3 py-2">{assetStatusLabels[asset.status]}</td>
                          <td className="px-3 py-2 break-all text-zinc-700">
                            {asset.localPath ?? asset.sourceUrl ?? asset.title ?? "未保存本地文件"}
                          </td>
                          <td className="px-3 py-2 text-zinc-500">{asset.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">还没有自动解析素材记录。</p>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">综述报告</h2>
              {project.reportMarkdown ? (
                <ReportText text={project.reportMarkdown} />
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  尚未生成报告。补充必要材料后点击“开始/重新研究”。
                </p>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">报告版本</h2>
              {project.reportVersions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {project.reportVersions.map((version) => (
                    <div key={version.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-zinc-900">V{version.versionNumber}</span>
                            {version.isCurrent ? (
                              <span className="rounded bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800">
                                当前版本
                              </span>
                            ) : null}
                            {version.isFinal ? (
                              <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                                最终主题
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">{dateText(version.createdAt)}</p>
                        </div>
                        <ResearchReportVersionActions versionId={version.id} />
                      </div>
                      {version.userInstruction ? (
                        <p className="mt-3 text-sm leading-6 text-zinc-700">本轮方向：{version.userInstruction}</p>
                      ) : null}
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                        {version.reportMarkdown.slice(0, 360)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">还没有报告版本。第一次生成报告后会自动保存 V1。</p>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">来源链接</h2>
              {sourceList(project.sourceList).length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {sourceList(project.sourceList).map((source) => (
                    <li key={`${source.type}-${source.url}`} className="rounded-md bg-zinc-50 px-3 py-2">
                      <div className="font-medium text-zinc-800">{source.title}</div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-teal-700 hover:text-teal-900"
                      >
                        {source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  暂无来源链接。重新研究后会保存原始链接和补充材料中的 URL。
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
