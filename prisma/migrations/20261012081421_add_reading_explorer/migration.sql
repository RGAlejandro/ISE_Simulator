-- AlterTable
ALTER TABLE "DailyUsage" ADD COLUMN     "readingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReadingText" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "answers" JSONB,
    "score" INTEGER,
    "total" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingLookup" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "paragraph" INTEGER NOT NULL,
    "sentence" INTEGER NOT NULL,
    "lemma" TEXT NOT NULL,
    "partOfSpeech" TEXT,
    "translation" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingText_level_locale_ownerId_idx" ON "ReadingText"("level", "locale", "ownerId");

-- CreateIndex
CREATE INDEX "ReadingSession_userId_createdAt_idx" ON "ReadingSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingSession_userId_readingId_key" ON "ReadingSession"("userId", "readingId");

-- CreateIndex
CREATE INDEX "ReadingLookup_word_paragraph_sentence_idx" ON "ReadingLookup"("word", "paragraph", "sentence");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingLookup_sessionId_word_paragraph_sentence_key" ON "ReadingLookup"("sessionId", "word", "paragraph", "sentence");

-- AddForeignKey
ALTER TABLE "ReadingText" ADD CONSTRAINT "ReadingText_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "ReadingText"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingLookup" ADD CONSTRAINT "ReadingLookup_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
