-- DropIndex
DROP INDEX "OralExam_userId_idx";

-- DropIndex
DROP INDEX "WrittenExam_userId_idx";

-- AlterTable
ALTER TABLE "DailyUsage" ADD COLUMN     "chatCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_ipHash_createdAt_idx" ON "Feedback"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "OralExam_userId_createdAt_idx" ON "OralExam"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WrittenExam_userId_createdAt_idx" ON "WrittenExam"("userId", "createdAt");
