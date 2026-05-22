import { prisma } from "../src/lib/db";

const dryRun = !process.argv.includes("--apply");
const windowMs = 2 * 60 * 1000;

async function main() {
  const projects = await prisma.researchProject.findMany({
    include: {
      reportVersions: {
        orderBy: { versionNumber: "asc" },
      },
    },
  });

  const deleteIds = new Set<string>();

  for (const project of projects) {
    const groups = new Map<string, typeof project.reportVersions>();

    for (const version of project.reportVersions) {
      if (!version.userInstruction) continue;
      const key = version.userInstruction.trim();
      groups.set(key, [...(groups.get(key) ?? []), version]);
    }

    for (const versions of groups.values()) {
      let cluster: typeof versions = [];

      for (const version of versions) {
        const previous = cluster.at(-1);
        if (!previous || version.createdAt.getTime() - previous.createdAt.getTime() <= windowMs) {
          cluster.push(version);
        } else {
          for (const duplicate of cluster.slice(0, -1)) deleteIds.add(duplicate.id);
          cluster = [version];
        }
      }

      for (const duplicate of cluster.slice(0, -1)) deleteIds.add(duplicate.id);
    }
  }

  const ids = Array.from(deleteIds);
  console.log(`${dryRun ? "Would delete" : "Deleting"} ${ids.length} duplicate report versions.`);

  if (!dryRun && ids.length > 0) {
    await prisma.researchReportVersion.deleteMany({
      where: { id: { in: ids } },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
