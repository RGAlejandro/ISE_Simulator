-- AlterTable
ALTER TABLE "DailyUsage" ADD COLUMN     "listeningCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ListeningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "passageText" TEXT NOT NULL,
    "passageTitle" TEXT NOT NULL,
    "passageTopic" TEXT NOT NULL,
    "round1Response" TEXT,
    "round1Feedback" JSONB,
    "round1Score" DOUBLE PRECISION,
    "round2Response" TEXT,
    "round2Feedback" JSONB,
    "round2Score" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningSession_userId_idx" ON "ListeningSession"("userId");

-- AddForeignKey
ALTER TABLE "ListeningSession" ADD CONSTRAINT "ListeningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
