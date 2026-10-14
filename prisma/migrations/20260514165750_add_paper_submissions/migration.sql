-- CreateTable
CREATE TABLE "PaperSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "feedback" JSONB,
    "score" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperSubmission_userId_idx" ON "PaperSubmission"("userId");

-- CreateIndex
CREATE INDEX "PaperSubmission_examId_idx" ON "PaperSubmission"("examId");

-- AddForeignKey
ALTER TABLE "PaperSubmission" ADD CONSTRAINT "PaperSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSubmission" ADD CONSTRAINT "PaperSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "WrittenExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
