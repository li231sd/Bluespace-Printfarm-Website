"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustEstimate = exports.updateJobStatus = exports.rejectJob = exports.approveJob = void 0;
const db_js_1 = require("../config/db.js");
const approveJob = async (jobId) => {
    return db_js_1.prisma.$transaction(async (tx) => {
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
exports.approveJob = approveJob;
const rejectJob = async (jobId, adminNotes) => {
    return db_js_1.prisma.$transaction(async (tx) => {
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
exports.rejectJob = rejectJob;
const updateJobStatus = async (jobId, status, adminNotes) => {
    return db_js_1.prisma.job.update({
        where: { id: jobId },
        data: {
            status,
            adminNotes
        }
    });
};
exports.updateJobStatus = updateJobStatus;
const adjustEstimate = async (jobId, filamentGrams, creditPerGram) => {
    const creditCost = filamentGrams * creditPerGram;
    return db_js_1.prisma.job.update({
        where: { id: jobId },
        data: {
            filamentGrams,
            creditCost
        }
    });
};
exports.adjustEstimate = adjustEstimate;
