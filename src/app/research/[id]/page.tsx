import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { isKnownPrismaConnectionError } from "@/lib/monitor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ResearchTaskRow = Prisma.ResearchTaskGetPayload<{ include: { video: true } }>;

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: ResearchTaskRow | null = null;
  let dbError = false;

  try {
    task = await prisma.researchTask.findUnique({
      where: { id },
      include: { video: true },
    });
  } catch (error) {
    if (isKnownPrismaConnectionError(error)) dbError = true;
    else throw error;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-6">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回雷达
        </Link>
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">研究任务占位</h1>
          {dbError ? (
            <p className="mt-3 text-sm text-amber-800">PostgreSQL 未连接，暂时不能读取研究任务。</p>
          ) : null}
          {!dbError && !task ? <p className="mt-3 text-sm text-zinc-600">没有找到这个研究任务。</p> : null}
          {task ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-500">第二阶段会在这里生成全网资料搜索、事实核查和研究报告。</p>
              <h2 className="text-lg font-semibold">{task.video.chineseTitle ?? task.video.originalTitle}</h2>
              <p className="text-sm leading-6 text-zinc-700">{task.video.chineseSummary}</p>
              <a
                href={task.video.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
              >
                查看原始链接
              </a>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
