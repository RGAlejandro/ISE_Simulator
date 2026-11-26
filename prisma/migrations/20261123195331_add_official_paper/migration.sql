-- CreateEnum
CREATE TYPE "OfficialPaperStatus" AS ENUM ('PARSED', 'TRANSCRIBED', 'MARKED');

-- CreateTable
CREATE TABLE "OfficialPaper" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "OfficialPaperStatus" NOT NULL DEFAULT 'PARSED',
    "content" JSONB NOT NULL,
    "answers" JSONB,
    "readingResult" JSONB,
    "task3PracticeId" TEXT,
    "task4PracticeId" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialPaper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficialPaper_userId_createdAt_idx" ON "OfficialPaper"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "OfficialPaper" ADD CONSTRAINT "OfficialPaper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
