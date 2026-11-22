-- AlterTable
ALTER TABLE "DailyUsage" ADD COLUMN     "writingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SavedWord" ADD COLUMN     "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "srsBox" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "examDate" DATE,
ADD COLUMN     "examLevel" "ExamLevel";

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "box" INTEGER NOT NULL,
    "xpAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingPractice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "taskType" "WrittenTaskType" NOT NULL,
    "genre" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "task" JSONB NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingPractice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingDraft" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'typed',
    "secondsUsed" INTEGER,
    "feedback" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewLog_userId_createdAt_idx" ON "ReviewLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_sessionKey_idx" ON "ReviewLog"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "WritingPractice_userId_createdAt_idx" ON "WritingPractice"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WritingDraft_practiceId_version_key" ON "WritingDraft"("practiceId", "version");

-- CreateIndex
CREATE INDEX "SavedWord_userId_dueAt_idx" ON "SavedWord"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "SavedWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingPractice" ADD CONSTRAINT "WritingPractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingDraft" ADD CONSTRAINT "WritingDraft_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "WritingPractice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
