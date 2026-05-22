CREATE TYPE "ResearchMaterialType" AS ENUM (
  'VIDEO',
  'IMAGE',
  'ARTICLE',
  'PRODUCT_PAGE',
  'OFFICIAL_DOC',
  'SOCIAL_POST',
  'DATASET',
  'SEARCH_QUERY',
  'OTHER'
);

CREATE TYPE "ResearchMaterialItemStatus" AS ENUM (
  'CANDIDATE',
  'SELECTED',
  'NEEDS_LICENSE_CHECK',
  'REJECTED'
);

CREATE TABLE "ResearchMaterial" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ResearchMaterialType" NOT NULL,
  "status" "ResearchMaterialItemStatus" NOT NULL DEFAULT 'CANDIDATE',
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "usage" TEXT,
  "copyrightRisk" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchMaterial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchMaterial_projectId_sourceUrl_key" ON "ResearchMaterial"("projectId", "sourceUrl");
CREATE INDEX "ResearchMaterial_projectId_idx" ON "ResearchMaterial"("projectId");
CREATE INDEX "ResearchMaterial_type_idx" ON "ResearchMaterial"("type");
CREATE INDEX "ResearchMaterial_status_idx" ON "ResearchMaterial"("status");

ALTER TABLE "ResearchMaterial" ADD CONSTRAINT "ResearchMaterial_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
