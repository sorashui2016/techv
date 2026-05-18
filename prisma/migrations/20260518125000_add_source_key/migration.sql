-- AlterTable
ALTER TABLE "Source" ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Source_sourceKey_key" ON "Source"("sourceKey");
