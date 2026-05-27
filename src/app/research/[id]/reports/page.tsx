import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ReportText } from "@/components/ReportText";
import { ResearchReportVersionActions } from "@/components/ResearchReportVersionActions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export default async function ResearchReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.researchProject.findUnique({
    where: { id },
    include: {
      reportVersions: { orderBy: { versionNumber: "desc" } },
    },
  });

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
              <h1 className="text-2xl font-bold">历史报告</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {project.title ?? project.oneLineConclusion ?? "未命名研究项目"}
              </p>
            </section>

            {project.reportVersions.length > 0 ? (
              project.reportVersions.map((version) => (
                <section key={version.id} className="rounded-lg border border-zinc-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">V{version.versionNumber}</h2>
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
                      {version.userInstruction ? (
                        <p className="mt-2 text-sm text-zinc-700">本轮方向：{version.userInstruction}</p>
                      ) : null}
                    </div>
                    <ResearchReportVersionActions versionId={version.id} />
                  </div>
                  <ReportText text={version.reportMarkdown} />
                </section>
              ))
            ) : (
              <section className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
                还没有历史报告。
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
