-- CreateEnum
CREATE TYPE "ExploreRuleType" AS ENUM ('SEARCH', 'BOOST', 'DEMOTE', 'EXCLUDE', 'AUTHORITY');

-- CreateEnum
CREATE TYPE "ExploreRuleStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExploreCandidateStatus" AS ENUM ('UNMARKED', 'CANDIDATE', 'PENDING', 'REJECTED', 'RESEARCH');

-- CreateEnum
CREATE TYPE "ExploreRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ExploreRule" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" "ExploreRuleType" NOT NULL,
    "category" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "platform" "Platform" NOT NULL DEFAULT 'YOUTUBE',
    "status" "ExploreRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreCandidate" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformContentId" TEXT,
    "originalUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "originalTitle" TEXT NOT NULL,
    "chineseTitle" TEXT,
    "description" TEXT,
    "chineseSummary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "likeCount" INTEGER,
    "viewCount" INTEGER,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreReason" TEXT,
    "tags" JSONB,
    "matchedRules" JSONB,
    "recommendationReason" TEXT,
    "status" "ExploreCandidateStatus" NOT NULL DEFAULT 'UNMARKED',
    "isTodayPick" BOOLEAN NOT NULL DEFAULT false,
    "todayPickDate" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreRun" (
    "id" TEXT NOT NULL,
    "status" "ExploreRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "searchedRuleCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "newCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExploreRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExploreRule_type_status_idx" ON "ExploreRule"("type", "status");

-- CreateIndex
CREATE INDEX "ExploreRule_platform_status_idx" ON "ExploreRule"("platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCandidate_originalUrl_key" ON "ExploreCandidate"("originalUrl");

-- CreateIndex
CREATE INDEX "ExploreCandidate_discoveredAt_idx" ON "ExploreCandidate"("discoveredAt");

-- CreateIndex
CREATE INDEX "ExploreCandidate_status_idx" ON "ExploreCandidate"("status");

-- CreateIndex
CREATE INDEX "ExploreCandidate_isTodayPick_todayPickDate_idx" ON "ExploreCandidate"("isTodayPick", "todayPickDate");

-- CreateIndex
CREATE INDEX "ExploreCandidate_platform_platformContentId_idx" ON "ExploreCandidate"("platform", "platformContentId");

-- CreateIndex
CREATE INDEX "ExploreRun_startedAt_idx" ON "ExploreRun"("startedAt");

-- CreateIndex
CREATE INDEX "ExploreRun_status_idx" ON "ExploreRun"("status");
