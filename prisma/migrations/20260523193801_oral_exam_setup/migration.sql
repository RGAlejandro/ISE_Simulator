-- AlterTable
ALTER TABLE "OralExam" ADD COLUMN     "selectedTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "topicDetailed" TEXT,
ADD COLUMN     "topicGeneral" TEXT;
