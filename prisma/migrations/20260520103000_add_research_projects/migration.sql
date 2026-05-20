CREATE TYPE "ResearchEntryType" AS ENUM ('RADAR_CARD', 'EXPLORE_CARD', 'MANUAL_LINK', 'FEISHU_LINK', 'API_WEBHOOK');
CREATE TYPE "ResearchProjectStatus" AS ENUM ('TODO', 'PARSING', 'NEEDS_SUPPLEMENT', 'SUPPLEMENT_SUBMITTED', 'UNDERSTANDING', 'SEARCHING_TEXT', 'WRITING_REPORT', 'REVIEW_PENDING', 'WORTH_DOING', 'PENDING', 'NOT_DOING', 'FAILED');
CREATE TYPE "ResearchMaterialStatus" AS ENUM ('NOT_STARTED', 'READY_TO_SEARCH', 'SEARCHING', 'DOWNLOADING', 'TRANSCRIBING', 'TRANSLATING', 'ORGANIZING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "ResearchSupplementType" AS ENUM ('TITLE', 'BODY', 'SHARE_TEXT', 'COMMENT', 'TRANSCRIPT', 'SUBTITLE', 'LINK', 'NOTE');
CREATE TYPE "ExternalSubmissionSource" AS ENUM ('MANUAL_WEB', 'FEISHU_MESSAGE', 'FEISHU_CARD_ACTION', 'API_WEBHOOK');

CREATE TABLE "ResearchProject" (
  "id" TEXT NOT NULL,
  "entryType" "ResearchEntryType" NOT NULL,
  "status" "ResearchProjectStatus" NOT NULL DEFAULT 'TODO',
  "materialStatus" "ResearchMaterialStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "originalUrl" TEXT NOT NULL,
  "platform" "Platform",
  "sourceVideoId" TEXT,
  "exploreCandidateId" TEXT,
  "title" TEXT,
  "oneLineConclusion" TEXT,
  "summary" TEXT,
  "researchTarget" TEXT,
  "targetKeywords" JSONB,
  "reportMarkdown" TEXT,
  "sourceList" JSONB,
  "recommendation" TEXT,
  "projectFolderPath" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchSupplement" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ResearchSupplementType" NOT NULL,
  "content" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchSupplement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalSubmission" (
  "id" TEXT NOT NULL,
  "source" "ExternalSubmissionSource" NOT NULL,
  "sender" TEXT,
  "text" TEXT,
  "urls" JSONB,
  "attachments" JSONB,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchProject_status_idx" ON "ResearchProject"("status");
CREATE INDEX "ResearchProject_materialStatus_idx" ON "ResearchProject"("materialStatus");
CREATE INDEX "ResearchProject_entryType_idx" ON "ResearchProject"("entryType");
CREATE INDEX "ResearchProject_sourceVideoId_idx" ON "ResearchProject"("sourceVideoId");
CREATE INDEX "ResearchProject_exploreCandidateId_idx" ON "ResearchProject"("exploreCandidateId");
CREATE INDEX "ResearchProject_createdAt_idx" ON "ResearchProject"("createdAt");
CREATE INDEX "ResearchSupplement_projectId_idx" ON "ResearchSupplement"("projectId");
CREATE INDEX "ResearchSupplement_type_idx" ON "ResearchSupplement"("type");
CREATE INDEX "ExternalSubmission_source_idx" ON "ExternalSubmission"("source");
CREATE INDEX "ExternalSubmission_projectId_idx" ON "ExternalSubmission"("projectId");
CREATE INDEX "ExternalSubmission_createdAt_idx" ON "ExternalSubmission"("createdAt");

ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_sourceVideoId_fkey" FOREIGN KEY ("sourceVideoId") REFERENCES "VideoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_exploreCandidateId_fkey" FOREIGN KEY ("exploreCandidateId") REFERENCES "ExploreCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchSupplement" ADD CONSTRAINT "ResearchSupplement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalSubmission" ADD CONSTRAINT "ExternalSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
