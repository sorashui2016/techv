import Link from "next/link";
import type {
  ResearchMaterialItemStatus,
  ResearchMaterialStatus,
  ResearchMaterialType,
  ResearchProjectStatus,
  ResearchSupplementType,
} from "@prisma/client";
import { Nav } from "@/components/Nav";
import { ReportText } from "@/components/ReportText";
import { ResearchIterationForm } from "@/components/ResearchIterationForm";
import { ResearchMaterialActions } from "@/components/ResearchMaterialActions";
import { ResearchMaterialBulkDownloadButton } from "@/components/ResearchMaterialBulkDownloadButton";
import { ResearchMaterialSearchForm } from "@/components/ResearchMaterialSearchForm";
import { ResearchMaterialThumbnail } from "@/components/ResearchMaterialThumbnail";
import {
  ResearchMaterialEmptyTrashButton,
  ResearchMaterialRestoreButton,
} from "@/components/ResearchMaterialTrashActions";
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

const materialTypeLabels: Record<ResearchMaterialType, string> = {
  VIDEO: "视频",
  IMAGE: "图片",
  ARTICLE: "文章",
  PRODUCT_PAGE: "产品页",
  OFFICIAL_DOC: "官方资料",
  SOCIAL_POST: "社媒反馈",
  DATASET: "数据",
  SEARCH_QUERY: "搜索入口",
  OTHER: "其他",
};

const materialItemStatusLabels: Record<ResearchMaterialItemStatus, string> = {
  CANDIDATE: "候选",
  SELECTED: "候选",
  NEEDS_LICENSE_CHECK: "候选",
  DOWNLOADING: "下载中",
  DOWNLOADED: "已下载",
  FAILED: "下载失败",
  REJECTED: "不用",
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

function dateOnlyText(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function ReportVersionCard({
  version,
}: {
  version: {
    id: string;
    versionNumber: number;
    isCurrent: boolean;
    isFinal: boolean;
    createdAt: Date;
    userInstruction: string | null;
    reportMarkdown: string;
  };
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900">V{version.versionNumber}</span>
            {version.isCurrent ? (
              <span className="rounded bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800">当前版本</span>
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
  );
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
      materials: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      reportVersions: { orderBy: { versionNumber: "desc" } },
    },
  });
  const currentReportVersion = project?.reportVersions.find((version) => version.isCurrent) ?? project?.reportVersions[0];
  const finalReportVersion = project?.reportVersions.find((version) => version.isFinal);
  const historyReportVersions = project?.reportVersions.filter((version) => version.id !== currentReportVersion?.id) ?? [];
  const activeMaterials =
    project?.materials.filter(
      (material) => material.status !== "REJECTED" && (material.type === "VIDEO" || material.type === "IMAGE"),
    ) ?? [];
  const trashedMaterials = project?.materials.filter((material) => material.status === "REJECTED") ?? [];

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

            <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">继续研究 / 调整方向</h2>
              <p className="sr-only">
                看完当前报告后，可以把新想法写在这里，让系统生成新版报告。适合用来扩展成合集、收窄主题、增加对比对象或补查某个方向。
              </p>
              <div className="mt-3">
                <ResearchIterationForm projectId={project.id} />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">补充材料</h2>
              <p className="sr-only">
                小红书、视频号或自动解析不足时，可粘贴转写文本、字幕、正文、评论、分享文案或相关链接。文案有错别字也可以。
              </p>
              <div className="mt-3">
                <ResearchSupplementForm projectId={project.id} />
              </div>
              {project.supplements.length > 0 ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {project.supplements.map((supplement) => (
                    <div key={supplement.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium text-zinc-500">
                          {supplementLabels[supplement.type]} · {dateText(supplement.createdAt)}
                        </div>
                        <ResearchSupplementDeleteButton supplementId={supplement.id} />
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                        {supplement.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            </div>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">自动解析素材</h2>
              <p className="mt-1 text-sm text-zinc-600">
                已下载或自动解析出来的本地文件不在详情页展开，避免占用筛选素材的空间。
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">已保存素材记录：{project.assets.length} 条</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {project.projectFolderPath ? `本地目录：${project.projectFolderPath}` : "还没有本地素材目录。"}
                  </p>
                </div>
                <Link
                  href={`/research/${project.id}/assets`}
                  target="_blank"
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  查看详情
                </Link>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">素材候选池</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    这里只显示可作为视频或图片素材的链接；研究来源链接继续保留在报告和来源区。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    {activeMaterials.length} 条
                  </span>
                  <ResearchMaterialBulkDownloadButton
                    projectId={project.id}
                    disabled={activeMaterials.length === 0}
                  />
                </div>
              </div>
              <ResearchMaterialSearchForm projectId={project.id} finalVersionNumber={finalReportVersion?.versionNumber} />
              {activeMaterials.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {activeMaterials.map((material) => (
                    <div
                      key={material.id}
                      className={`overflow-hidden rounded-md border ${
                        material.status === "DOWNLOADED"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                        <a
                          href={material.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block aspect-video bg-zinc-200"
                        >
                          <ResearchMaterialThumbnail
                            thumbnailUrl={material.thumbnailUrl}
                            sourceUrl={material.sourceUrl}
                            title={material.chineseTitle ?? material.title}
                          />
                        </a>
                        <div className="min-w-0 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded bg-white px-2 py-1 font-medium text-zinc-700">
                                  {materialTypeLabels[material.type]}
                                </span>
                                <span
                                  className={`rounded px-2 py-1 font-medium ${
                                    material.status === "DOWNLOADED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-50 text-amber-800"
                                  }`}
                                >
                                  {materialItemStatusLabels[material.status]}
                                </span>
                              </div>
                              <h3 className="mt-2 text-base font-semibold text-zinc-950">
                                {material.chineseTitle ?? material.title}
                              </h3>
                              {material.chineseTitle && material.chineseTitle !== material.title ? (
                                <p className="mt-1 text-xs text-zinc-500">{material.title}</p>
                              ) : null}
                              <p className="mt-1 text-xs text-zinc-500">
                                发布时间：{material.publishedAt ? dateOnlyText(material.publishedAt) : "未知"}
                              </p>
                              <a
                                href={material.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 block break-all text-sm text-teal-700 hover:text-teal-900"
                              >
                                {material.sourceUrl}
                              </a>
                            </div>
                            <ResearchMaterialActions materialId={material.id} status={material.status} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  还没有视频/图片素材候选。点击“搜索素材”后，系统会抓取具体视频或图片链接。
                </p>
              )}
              {trashedMaterials.length > 0 ? (
                <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-700">
                    <span>垃圾箱 {trashedMaterials.length} 条</span>
                    <ResearchMaterialEmptyTrashButton projectId={project.id} disabled={trashedMaterials.length === 0} />
                  </summary>
                  <div className="space-y-2 border-t border-zinc-200 p-3">
                    {trashedMaterials.map((material) => (
                      <div key={material.id} className="rounded-md border border-zinc-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                                {materialTypeLabels[material.type]}
                              </span>
                              <span className="rounded bg-rose-50 px-2 py-1 font-medium text-rose-700">
                                {materialItemStatusLabels[material.status]}
                              </span>
                            </div>
                            <h3 className="mt-2 text-sm font-semibold text-zinc-800">{material.title}</h3>
                            <a
                              href={material.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block break-all text-xs text-teal-700 hover:text-teal-900"
                            >
                              {material.sourceUrl}
                            </a>
                          </div>
                          <ResearchMaterialRestoreButton materialId={material.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
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
                  {currentReportVersion ? <ReportVersionCard version={currentReportVersion} /> : null}
                  {historyReportVersions.length > 0 ? (
                    <details className="rounded-md border border-zinc-200 bg-white">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700">
                        历史版本 {historyReportVersions.length} 个
                      </summary>
                      <div className="space-y-3 border-t border-zinc-100 p-3">
                        {historyReportVersions.map((version) => (
                          <ReportVersionCard key={version.id} version={version} />
                        ))}
                      </div>
                    </details>
                  ) : null}
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
