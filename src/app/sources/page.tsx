import type { Prisma } from "@prisma/client";
import { MonitorAllButton } from "@/components/MonitorAllButton";
import { Nav } from "@/components/Nav";
import { SourceActions } from "@/components/SourceActions";
import { SourceForm } from "@/components/SourceForm";
import { isKnownPrismaConnectionError } from "@/lib/monitor";
import { platformLabels, tierLabels } from "@/lib/labels";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SourceRow = Prisma.SourceGetPayload<object>;

function dateText(date?: Date | null) {
  if (!date) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function SourcesPage() {
  let sources: SourceRow[] = [];
  let dbError = false;

  try {
    sources = await prisma.source.findMany({
      orderBy: [{ tier: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    if (isKnownPrismaConnectionError(error)) dbError = true;
    else throw error;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold">信息源管理</h1>
            <p className="mt-1 text-sm text-zinc-600">
              普通账号每天北京时间 08:00 监测；重要账号在 00:00 / 04:00 / 08:00 / 12:00 / 16:00 / 20:00 监测。
            </p>
          </div>
          <MonitorAllButton />
        </div>

        <SourceForm />

        {dbError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            PostgreSQL 未连接，暂时不能读取或新增信息源。
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">最近监测</th>
                <th className="px-4 py-3">结果</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const hasError = source.lastCheckStatus === "failed" || Boolean(source.lastCheckError);
                const rowClass = hasError
                  ? "bg-rose-50"
                  : source.tier === "IMPORTANT"
                    ? "bg-zinc-50"
                    : "";

                return (
                  <tr key={source.id} className={`border-t border-zinc-100 ${rowClass}`}>
                    <td className="px-4 py-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-950 hover:text-teal-700"
                      >
                        {source.name}
                      </a>
                      {hasError ? (
                        <div className="mt-2 inline-flex rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                          链接需要处理：删除或替换为正确链接
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{platformLabels[source.platform]}</td>
                    <td className="px-4 py-3">{tierLabels[source.tier]}</td>
                    <td className="px-4 py-3">{source.status === "ACTIVE" ? "启用" : "禁用"}</td>
                    <td className="px-4 py-3">{dateText(source.lastCheckedAt)}</td>
                    <td className="px-4 py-3">
                      <div className={hasError ? "font-medium text-rose-700" : ""}>
                        {hasError ? "failed · 需要处理" : source.lastCheckStatus ?? "未知"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SourceActions
                        sourceId={source.id}
                        status={source.status}
                        tier={source.tier}
                        url={source.url}
                        hasError={hasError}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
