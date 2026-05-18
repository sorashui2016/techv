import type { Prisma } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { isKnownPrismaConnectionError } from "@/lib/monitor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type MonitorRunRow = Prisma.MonitorRunGetPayload<{ include: { source: true } }>;

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

export default async function LogsPage() {
  let runs: MonitorRunRow[] = [];
  let dbError = false;

  try {
    runs = await prisma.monitorRun.findMany({
      include: { source: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
  } catch (error) {
    if (isKnownPrismaConnectionError(error)) dbError = true;
    else throw error;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold">监测日志</h1>
          <p className="mt-1 text-sm text-zinc-600">记录最近监测时间、成功状态、新视频数量和错误原因。</p>
        </div>

        {dbError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            PostgreSQL 未连接，暂时不能读取监测日志。
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">开始时间</th>
                <th className="px-4 py-3">信息源</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">新视频</th>
                <th className="px-4 py-3">更新</th>
                <th className="px-4 py-3">错误</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{dateText(run.startedAt)}</td>
                  <td className="px-4 py-3">{run.source?.name ?? "手动/未知"}</td>
                  <td className="px-4 py-3">
                    <span className={run.status === "SUCCESS" ? "text-emerald-700" : "text-rose-700"}>
                      {run.status === "SUCCESS" ? "成功" : "失败"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{run.newVideoCount}</td>
                  <td className="px-4 py-3">{run.updatedCount}</td>
                  <td className="px-4 py-3">
                    <span className="line-clamp-2 text-xs text-zinc-500">{run.errorMessage}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
