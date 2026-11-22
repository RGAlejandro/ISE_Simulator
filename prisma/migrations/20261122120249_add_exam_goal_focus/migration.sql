-- CreateEnum
CREATE TYPE "ExamModules" AS ENUM ('BOTH', 'READING_WRITING', 'SPEAKING_LISTENING');

-- CreateEnum
CREATE TYPE "TargetBand" AS ENUM ('PASS', 'MERIT', 'DISTINCTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "examModules" "ExamModules" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "targetBand" "TargetBand" NOT NULL DEFAULT 'PASS';
