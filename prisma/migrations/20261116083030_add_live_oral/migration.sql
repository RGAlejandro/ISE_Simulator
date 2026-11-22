-- AlterTable
ALTER TABLE "OralExam" ADD COLUMN     "liveMetrics" JSONB,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'classic';
