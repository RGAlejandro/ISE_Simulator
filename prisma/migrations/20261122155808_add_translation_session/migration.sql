-- CreateTable
CREATE TABLE "TranslationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "sourceLang" TEXT NOT NULL DEFAULT 'es',
    "items" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationSession_userId_createdAt_idx" ON "TranslationSession"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TranslationSession" ADD CONSTRAINT "TranslationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
