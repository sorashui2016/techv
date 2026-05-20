import { prisma } from "../src/lib/db";
import { normalizeResearchReport } from "../src/lib/research";

async function main() {
  const projects = await prisma.researchProject.findMany({
    where: { reportMarkdown: { not: null } },
    select: { id: true, reportMarkdown: true },
  });
  let updated = 0;

  for (const project of projects) {
    if (!project.reportMarkdown) continue;
    const cleaned = normalizeResearchReport(project.reportMarkdown);
    if (cleaned !== project.reportMarkdown) {
      await prisma.researchProject.update({
        where: { id: project.id },
        data: { reportMarkdown: cleaned },
      });
      updated += 1;
    }
  }

  console.log(`Cleaned ${updated}/${projects.length} research reports.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
