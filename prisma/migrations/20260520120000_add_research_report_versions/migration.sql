ALTER TYPE "ResearchProjectStatus" ADD VALUE IF NOT EXISTS 'ITERATING';
ALTER TYPE "ResearchProjectStatus" ADD VALUE IF NOT EXISTS 'THEME_CONFIRMED';

CREATE TABLE IF NOT EXISTS "ResearchReportVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "userInstruction" TEXT,
  "theme" TEXT,
  "reportMarkdown" TEXT NOT NULL,
  "sourceList" JSONB,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "isFinal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchReportVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResearchReportVersion_projectId_idx" ON "ResearchReportVersion"("projectId");
CREATE INDEX IF NOT EXISTS "ResearchReportVersion_projectId_versionNumber_idx" ON "ResearchReportVersion"("projectId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ResearchReportVersion_isCurrent_idx" ON "ResearchReportVersion"("isCurrent");
CREATE INDEX IF NOT EXISTS "ResearchReportVersion_isFinal_idx" ON "ResearchReportVersion"("isFinal");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResearchReportVersion_projectId_fkey'
  ) THEN
    ALTER TABLE "ResearchReportVersion"
      ADD CONSTRAINT "ResearchReportVersion_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
