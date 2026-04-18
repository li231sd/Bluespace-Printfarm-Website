import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

export const logAudit = async (
  adminUserId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  details?: Prisma.InputJsonValue,
) => {
  return prisma.auditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId,
      details,
    },
  });
};
