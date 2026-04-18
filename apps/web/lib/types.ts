export type Role = "USER" | "ADMIN";

export type JobStatus =
  | "PENDING"
  | "APPROVED"
  | "PRINTING"
  | "COMPLETED"
  | "REJECTED";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  credits: number;
};

export type AuthPayload = {
  token: string;
  user: SessionUser;
};

export type Job = {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  filamentGrams: number;
  creditCost: number;
  status: JobStatus;
  userId: string;
  adminNotes?: string | null;
  needsAttentionFlags?: string[];
  queuePosition?: number | null;
  etaMinutes?: number | null;
  timeline?: JobTimelineEvent[];
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    credits: number;
  };
};

export type JobTimelineEvent = {
  id: string;
  jobId: string;
  status?: JobStatus | null;
  label: string;
  notes?: string | null;
  actorUserId?: string | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  jobId?: string | null;
  type: "JOB_SUBMITTED" | "JOB_STATUS_CHANGED" | "JOB_NEEDS_ATTENTION" | "CREDIT_UPDATED";
  channel: "IN_APP" | "EMAIL";
  title: string;
  message: string;
  readAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  action: "JOB_STATUS_UPDATED" | "JOB_DELETED" | "CREDIT_ADJUSTED" | "USER_DELETED";
  entityType: string;
  entityId: string;
  adminUserId: string;
  details?: unknown;
  createdAt: string;
  adminUser?: {
    id: string;
    email: string;
    name: string | null;
  };
};
