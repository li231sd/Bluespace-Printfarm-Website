-- AlterTable
ALTER TABLE "Job" ADD COLUMN "virusScanId" TEXT,
ADD COLUMN "virusClean" BOOLEAN,
ADD COLUMN "virusThreats" TEXT,
ADD COLUMN "virusSeverity" TEXT,
ADD COLUMN "virusDetectionRatio" TEXT,
ADD COLUMN "virusScanDate" TIMESTAMP(3);
