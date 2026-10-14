-- CreateTable
CREATE TABLE "GamificationStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,
    "todayXp" INTEGER NOT NULL DEFAULT 0,
    "dailyGoal" INTEGER NOT NULL DEFAULT 30,
    "totalAnswered" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "questsDone" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyXp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyXp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamificationStats_userId_key" ON "GamificationStats"("userId");

-- CreateIndex
CREATE INDEX "WeeklyXp_weekStart_idx" ON "WeeklyXp"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyXp_userId_weekStart_key" ON "WeeklyXp"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "GamificationStats" ADD CONSTRAINT "GamificationStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyXp" ADD CONSTRAINT "WeeklyXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
