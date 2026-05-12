-- CreateTable
CREATE TABLE "GrammarSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "responses" JSONB,
    "feedback" JSONB,
    "score" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrammarSession_userId_idx" ON "GrammarSession"("userId");

-- AddForeignKey
ALTER TABLE "GrammarSession" ADD CONSTRAINT "GrammarSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
