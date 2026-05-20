import Link from "next/link";
import type { ResearchMaterialStatus, ResearchProjectStatus } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

const statusLabels: Record<ResearchProjectStatus | "ALL", string> = {
  ALL: "全部",
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

function isResearchProjectStatus(value: string): value is ResearchProjectStatus {
  return Object.keys(statusLabels).includes(value) && value !== "ALL";
}

export default async function ResearchPoolPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedStatus = params.status ?? "ALL";
  const projects = await prisma.researchProject.findMany({
    where: isResearchProjectStatus(selectedStatus) ? { status: selectedStatus } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold">研究池</h1>
            <p className="mt-1 text-sm text-zinc-600">
              保存从雷达卡片、探索卡片或手动链接创建的研究项目；可以反复迭代报告，确认主题后再进入素材搜索。
            </p>
          </div>
          <Link href="/research/new" className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white">
            手动提交研究链接
          </Link>
        </div>

        <form className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-white p-3">
          <select name="status" defaultValue={selectedStatus} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white">筛选</button>
        </form>

        <section className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/research/${project.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-teal-300"
            >
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
              </div>
              <h2 className="mt-3 text-base font-semibold text-zinc-950">
                {project.title ?? project.oneLineConclusion ?? project.originalUrl}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">
                {project.oneLineConclusion ?? project.summary ?? "尚未生成研究报告"}
              </p>
              <div className="mt-3 text-xs text-zinc-500">
                创建：{dateText(project.createdAt)} · 更新：{dateText(project.updatedAt)}
              </div>
            </Link>
          ))}
        </section>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
            当前没有研究项目。
          </div>
        ) : null}
      </main>
    </>
  );
}
