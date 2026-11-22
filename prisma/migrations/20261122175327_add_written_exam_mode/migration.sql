-- CreateEnum
CREATE TYPE "WrittenExamMode" AS ENUM ('FULL', 'READING');

-- AlterTable
ALTER TABLE "WrittenExam" ADD COLUMN     "mode" "WrittenExamMode" NOT NULL DEFAULT 'FULL';
