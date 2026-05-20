import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ResearchNewForm } from "@/components/ResearchNewForm";

export const dynamic = "force-dynamic";

export default function NewResearchPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-6">
        <Link href="/research" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回研究池
        </Link>
        <section>
          <h1 className="text-2xl font-semibold">手动提交研究链接</h1>
          <p className="mt-1 text-sm text-zinc-600">
            这个入口用于直接创建研究项目，不会加入首页雷达池。飞书发链接研究的入口后续会复用同一套项目创建逻辑。
          </p>
        </section>
        <ResearchNewForm />
      </main>
    </>
  );
}
