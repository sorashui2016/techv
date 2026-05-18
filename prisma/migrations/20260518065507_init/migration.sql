-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'RSS', 'WEB', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('NORMAL', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ViewState" AS ENUM ('UNVIEWED', 'VIEWED');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('UNMARKED', 'CANDIDATE', 'DONE', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PushStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "tier" "SourceTier" NOT NULL DEFAULT 'NORMAL',
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckStatus" TEXT,
    "lastCheckError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "platform" "Platform" NOT NULL,
    "platformVideoId" TEXT,
    "originalUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "thumbnailUrl" TEXT,
    "originalTitle" TEXT NOT NULL,
    "chineseTitle" TEXT,
    "description" TEXT,
    "chineseSummary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "likeCount" INTEGER,
    "sourceName" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreReason" TEXT,
    "viewState" "ViewState" NOT NULL DEFAULT 'UNVIEWED',
    "viewedAt" TIMESTAMP(3),
    "decisionStatus" "DecisionStatus" NOT NULL DEFAULT 'UNMARKED',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "translationStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "summaryStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "pushStatus" "PushStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" "MonitorStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "newVideoCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'TODO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushEvent" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'feishu',
    "status" "PushStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE INDEX "Source_platform_status_idx" ON "Source"("platform", "status");

-- CreateIndex
CREATE INDEX "Source_tier_status_idx" ON "Source"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VideoItem_originalUrl_key" ON "VideoItem"("originalUrl");

-- CreateIndex
CREATE INDEX "VideoItem_detectedAt_idx" ON "VideoItem"("detectedAt");

-- CreateIndex
CREATE INDEX "VideoItem_decisionStatus_idx" ON "VideoItem"("decisionStatus");

-- CreateIndex
CREATE INDEX "VideoItem_viewState_decisionStatus_idx" ON "VideoItem"("viewState", "decisionStatus");

-- CreateIndex
CREATE INDEX "VideoItem_platform_platformVideoId_idx" ON "VideoItem"("platform", "platformVideoId");

-- CreateIndex
CREATE INDEX "MonitorRun_startedAt_idx" ON "MonitorRun"("startedAt");

-- CreateIndex
CREATE INDEX "MonitorRun_status_idx" ON "MonitorRun"("status");

-- CreateIndex
CREATE INDEX "ResearchTask_status_idx" ON "ResearchTask"("status");

-- CreateIndex
CREATE INDEX "ResearchTask_videoId_idx" ON "ResearchTask"("videoId");

-- CreateIndex
CREATE INDEX "PushEvent_provider_status_idx" ON "PushEvent"("provider", "status");

-- AddForeignKey
ALTER TABLE "VideoItem" ADD CONSTRAINT "VideoItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRun" ADD CONSTRAINT "MonitorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTask" ADD CONSTRAINT "ResearchTask_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushEvent" ADD CONSTRAINT "PushEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
