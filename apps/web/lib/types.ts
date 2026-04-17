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
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    credits: number;
  };
};
