-- AlterTable
ALTER TABLE "GrammarSession" ADD COLUMN     "focus" TEXT,
ADD COLUMN     "lesson" JSONB;

-- CreateIndex
CREATE INDEX "GrammarSession_userId_focus_idx" ON "GrammarSession"("userId", "focus");
