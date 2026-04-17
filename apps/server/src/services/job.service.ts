import { JobStatus } from "@prisma/client";
import { prisma } from "../config/db.js";

const CHARGED_STATUSES = new Set<JobStatus>(["APPROVED", "PRINTING", "COMPLETED"]);

export const approveJob = async (jobId: string) => {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { user: true } });
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "PENDING") {
      throw new Error("Only pending jobs can be approved");
    }

    if (job.user.credits < job.creditCost) {
      throw new Error("User has insufficient credits");
    }

    await tx.user.update({
      where: { id: job.userId },
      data: { credits: { decrement: job.creditCost } }
    });

    await tx.creditTransaction.create({
      data: {
        userId: job.userId,
        amount: -job.creditCost,
        reason: "JOB_APPROVED",
        jobId: job.id
      }
    });

    return tx.job.update({
      where: { id: jobId },
      data: { status: "APPROVED" }
    });
  });
};

export const rejectJob = async (jobId: string, adminNotes?: string) => {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new Error("Job not found");
    }

    const shouldRefund = ["APPROVED", "PRINTING", "COMPLETED"].includes(job.status);
    if (shouldRefund) {
      await tx.user.update({
        where: { id: job.userId },
        data: { credits: { increment: job.creditCost } }
      });

      await tx.creditTransaction.create({
        data: {
          userId: job.userId,
          amount: job.creditCost,
          reason: "JOB_REJECTED_REFUND",
          jobId: job.id
        }
      });
    }

    return tx.job.update({
      where: { id: jobId },
      data: {
        status: "REJECTED",
        adminNotes
      }
    });
  });
};

export const updateJobStatus = async (jobId: string, status: JobStatus, adminNotes?: string) => {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({
      where: { id: jobId },
      include: { user: true }
    });

    if (!job) {
      throw new Error("Job not found");
    }

    const wasCharged = CHARGED_STATUSES.has(job.status);
    const shouldBeCharged = CHARGED_STATUSES.has(status);

    if (!wasCharged && shouldBeCharged) {
      if (job.user.credits < job.creditCost) {
        throw new Error("User has insufficient credits");
      }

      await tx.user.update({
        where: { id: job.userId },
        data: { credits: { decrement: job.creditCost } }
      });

      await tx.creditTransaction.create({
        data: {
          userId: job.userId,
          amount: -job.creditCost,
          reason: "JOB_STATUS_DEBIT",
          jobId: job.id
        }
      });
    }

    if (wasCharged && !shouldBeCharged) {
      await tx.user.update({
        where: { id: job.userId },
        data: { credits: { increment: job.creditCost } }
      });

      await tx.creditTransaction.create({
        data: {
          userId: job.userId,
          amount: job.creditCost,
          reason: "JOB_STATUS_REFUND",
          jobId: job.id
        }
      });
    }

    return tx.job.update({
      where: { id: jobId },
      data: {
        status,
        adminNotes
      }
    });
  });
};

export const adjustEstimate = async (jobId: string, filamentGrams: number, creditPerGram: number) => {
  const creditCost = filamentGrams * creditPerGram;
  return prisma.job.update({
    where: { id: jobId },
    data: {
      filamentGrams,
      creditCost
    }
  });
};