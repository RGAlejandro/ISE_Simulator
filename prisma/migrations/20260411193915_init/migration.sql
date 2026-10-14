-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExamLevel" AS ENUM ('ISE_FOUNDATION', 'ISE_I', 'ISE_II', 'ISE_III', 'ISE_IV');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EVALUATED');

-- CreateEnum
CREATE TYPE "WrittenTaskType" AS ENUM ('READING_1', 'READING_2', 'READING_INTO_WRITING', 'EXTENDED_WRITING');

-- CreateEnum
CREATE TYPE "OralTaskType" AS ENUM ('TOPIC', 'COLLABORATIVE', 'CONVERSATION', 'LISTENING');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EXAMINER', 'CANDIDATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrittenExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "content" JSONB NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrittenExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrittenResponse" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "taskType" "WrittenTaskType" NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "response" TEXT NOT NULL,
    "aiFeedback" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrittenResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OralExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "overallScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OralExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OralExchange" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "taskType" "OralTaskType" NOT NULL,
    "role" "Role" NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OralFeedback" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "taskType" "OralTaskType" NOT NULL,
    "feedback" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OralFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "writtenCount" INTEGER NOT NULL DEFAULT 0,
    "oralCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "WrittenExam_userId_idx" ON "WrittenExam"("userId");

-- CreateIndex
CREATE INDEX "WrittenResponse_examId_idx" ON "WrittenResponse"("examId");

-- CreateIndex
CREATE INDEX "OralExam_userId_idx" ON "OralExam"("userId");

-- CreateIndex
CREATE INDEX "OralExchange_examId_idx" ON "OralExchange"("examId");

-- CreateIndex
CREATE INDEX "OralFeedback_examId_idx" ON "OralFeedback"("examId");

-- CreateIndex
CREATE INDEX "DailyUsage_userId_date_idx" ON "DailyUsage"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_date_key" ON "DailyUsage"("userId", "date");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrittenExam" ADD CONSTRAINT "WrittenExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrittenResponse" ADD CONSTRAINT "WrittenResponse_examId_fkey" FOREIGN KEY ("examId") REFERENCES "WrittenExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralExam" ADD CONSTRAINT "OralExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralExchange" ADD CONSTRAINT "OralExchange_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OralExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OralFeedback" ADD CONSTRAINT "OralFeedback_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OralExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
