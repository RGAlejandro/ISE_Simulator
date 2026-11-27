-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "selfAssessment" JSONB;

-- Learners who already set their exam level skip the welcome.
UPDATE "User" SET "onboardedAt" = "updatedAt" WHERE "examLevel" IS NOT NULL;
