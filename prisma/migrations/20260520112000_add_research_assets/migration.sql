CREATE TYPE "ResearchAssetType" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE', 'SUBTITLE', 'TRANSCRIPT', 'KEYFRAME', 'OTHER');
CREATE TYPE "ResearchAssetStatus" AS ENUM ('SAVED', 'FAILED', 'NEEDS_MANUAL_UPLOAD');

CREATE TABLE "ResearchAsset" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ResearchAssetType" NOT NULL,
  "status" "ResearchAssetStatus" NOT NULL DEFAULT 'SAVED',
  "title" TEXT,
  "sourceUrl" TEXT,
  "localPath" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchAsset_projectId_idx" ON "ResearchAsset"("projectId");
CREATE INDEX "ResearchAsset_type_idx" ON "ResearchAsset"("type");
CREATE INDEX "ResearchAsset_status_idx" ON "ResearchAsset"("status");

ALTER TABLE "ResearchAsset" ADD CONSTRAINT "ResearchAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
