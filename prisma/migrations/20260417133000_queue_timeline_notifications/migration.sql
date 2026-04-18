-- Create enums
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationType" AS ENUM ('JOB_SUBMITTED', 'JOB_STATUS_CHANGED', 'JOB_NEEDS_ATTENTION', 'CREDIT_UPDATED');
CREATE TYPE "AuditAction" AS ENUM ('JOB_STATUS_UPDATED', 'JOB_DELETED', 'CREDIT_ADJUSTED', 'USER_DELETED');

-- Extend Job with attention flags
ALTER TABLE "Job"
ADD COLUMN "needsAttentionFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Create timeline table
CREATE TABLE "JobTimelineEvent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "status" "JobStatus",
  "label" TEXT NOT NULL,
  "notes" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobTimelineEvent_jobId_createdAt_idx" ON "JobTimelineEvent"("jobId", "createdAt");

ALTER TABLE "JobTimelineEvent"
ADD CONSTRAINT "JobTimelineEvent_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobTimelineEvent"
ADD CONSTRAINT "JobTimelineEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create notifications table
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT,
  "type" "NotificationType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_channel_readAt_createdAt_idx" ON "Notification"("userId", "channel", "readAt", "createdAt");
CREATE INDEX "Notification_jobId_createdAt_idx" ON "Notification"("jobId", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create audit logs table
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_adminUserId_createdAt_idx" ON "AuditLog"("adminUserId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
