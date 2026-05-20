import type { ExploreRuleType } from "@prisma/client";
import { ExploreRuleActions } from "@/components/ExploreRuleActions";
import { ExploreRuleForm } from "@/components/ExploreRuleForm";
import { ExploreRunButton } from "@/components/ExploreRunButton";
import { Nav } from "@/components/Nav";
import { ensureDefaultExploreRules } from "@/lib/explore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const typeLabels: Record<ExploreRuleType, string> = {
  SEARCH: "搜索关键词",
  BOOST: "加分关键词",
  DEMOTE: "降权关键词",
  EXCLUDE: "排除关键词",
  AUTHORITY: "权威来源关键词",
};

export default async function ExploreRulesPage() {
  await ensureDefaultExploreRules();
  const rules = await prisma.exploreRule.findMany({
    orderBy: [{ status: "asc" }, { type: "asc" }, { weight: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold">探索规则管理</h1>
            <p className="mt-1 text-sm text-zinc-600">
              规则存入数据库，修改后会在下一次探索搜索时生效。
            </p>
          </div>
          <ExploreRunButton />
        </div>

        <ExploreRuleForm />

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">关键词</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">权重</th>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">备注</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-950">{rule.keyword}</td>
                  <td className="px-4 py-3">{typeLabels[rule.type]}</td>
                  <td className="px-4 py-3">{rule.category}</td>
                  <td className="px-4 py-3">{rule.weight}</td>
                  <td className="px-4 py-3">{rule.platform}</td>
                  <td className="px-4 py-3">{rule.status === "ACTIVE" ? "启用" : "禁用"}</td>
                  <td className="px-4 py-3 text-zinc-500">{rule.notes}</td>
                  <td className="px-4 py-3">
                    <ExploreRuleActions ruleId={rule.id} status={rule.status} />
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
