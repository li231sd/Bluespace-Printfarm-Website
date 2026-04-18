"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJob = exports.downloadJobFile = exports.analyticsSummary = exports.patchEstimate = exports.patchStatus = exports.reject = exports.approve = exports.allJobs = exports.myJobs = exports.uploadJobFile = exports.createJob = void 0;
const client_1 = require("@prisma/client");
const db_js_1 = require("../config/db.js");
const env_js_1 = require("../config/env.js");
const audit_service_js_1 = require("../services/audit.service.js");
const job_inspection_service_js_1 = require("../services/job-inspection.service.js");
const job_service_js_1 = require("../services/job.service.js");
const notification_service_js_1 = require("../services/notification.service.js");
const storage_service_js_1 = require("../services/storage.service.js");
const http_js_1 = require("../utils/http.js");
const estimateFilamentGrams = (fileSizeBytes) => {
    // Conservative heuristic calibrated to avoid underestimating lightweight parts.
    const gramsFromFileSize = Math.ceil(fileSizeBytes / Math.max(1, env_js_1.env.autoEstimateBytesPerGram));
    return Math.max(env_js_1.env.minimumFilamentGrams, gramsFromFileSize);
};
const statusLabel = {
    PENDING: "pending review",
    APPROVED: "approved",
    PRINTING: "printing",
    COMPLETED: "completed",
    REJECTED: "rejected"
};
const notifyAdmins = async (input) => {
    const admins = await db_js_1.prisma.user.findMany({
        where: { role: "ADMIN" },
        select: {
            id: true,
            email: true
        }
    });
    await Promise.all(admins.map((admin) => (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
        userId: admin.id,
        userEmail: admin.email,
        jobId: input.jobId,
        type: input.type,
        title: input.title,
        message: input.message,
        notifyEmail: input.notifyEmail
    })));
};
const createJob = async (req, res) => {
    const user = req.user;
    if (!user) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const { title, description, fileSize, fileUrl, fileName } = req.body;
    if (!title || !fileName || !fileUrl || !fileSize || fileSize < 1) {
        return (0, http_js_1.fail)(res, 400, "Missing required job fields");
    }
    const account = await db_js_1.prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            email: true,
            credits: true
        }
    });
    if (!account) {
        return (0, http_js_1.fail)(res, 404, "User not found");
    }
    const filamentGrams = estimateFilamentGrams(fileSize);
    const creditCost = Math.ceil(filamentGrams * env_js_1.env.creditPerGram);
    const modelInspection = await (0, job_inspection_service_js_1.inspectModelFile)(fileName, fileUrl);
    const needsAttentionFlags = (0, job_inspection_service_js_1.buildNeedsAttentionFlags)({
        fileFlags: modelInspection.flags,
        hasUnclearSpecs: !description || description.trim().length < 12,
        hasCreditIssue: account.credits < creditCost
    });
    const job = await db_js_1.prisma.$transaction(async (tx) => {
        const createdJob = await tx.job.create({
            data: {
                title,
                description,
                filamentGrams,
                creditCost,
                fileName,
                fileUrl,
                userId: user.id,
                needsAttentionFlags
            }
        });
        await tx.jobTimelineEvent.create({
            data: {
                jobId: createdJob.id,
                status: "PENDING",
                label: "Submitted",
                actorUserId: user.id
            }
        });
        return createdJob;
    });
    await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
        userId: account.id,
        userEmail: account.email,
        jobId: job.id,
        type: "JOB_SUBMITTED",
        title: "Print request submitted",
        message: `Your request "${job.title}" is in queue and awaiting review.`,
        notifyEmail: true
    });
    await notifyAdmins({
        jobId: job.id,
        type: "JOB_SUBMITTED",
        title: "New print request",
        message: `A new request "${job.title}" was submitted and is awaiting review.`
    });
    if (needsAttentionFlags.length > 0) {
        const attentionMessage = `Request "${job.title}" needs attention: ${needsAttentionFlags.join(", ")}.`;
        await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
            userId: account.id,
            userEmail: account.email,
            jobId: job.id,
            type: "JOB_NEEDS_ATTENTION",
            title: "Submission has warnings",
            message: attentionMessage,
            notifyEmail: true
        });
        await notifyAdmins({
            jobId: job.id,
            type: "JOB_NEEDS_ATTENTION",
            title: "Job needs manager review",
            message: attentionMessage
        });
    }
    return (0, http_js_1.created)(res, {
        ...job,
        preflightWarnings: modelInspection.warnings
    }, "Submission created and pending review");
};
exports.createJob = createJob;
const uploadJobFile = async (req, res) => {
    if (!req.file) {
        return (0, http_js_1.fail)(res, 400, "No file uploaded");
    }
    const uploaded = await (0, storage_service_js_1.uploadFileToStorage)(req.file);
    return (0, http_js_1.created)(res, uploaded, "File uploaded");
};
exports.uploadJobFile = uploadJobFile;
const myJobs = async (req, res) => {
    const user = req.user;
    if (!user) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const jobs = await db_js_1.prisma.job.findMany({
        where: { userId: user.id },
        include: {
            timeline: {
                orderBy: { createdAt: "asc" }
            }
        },
        orderBy: { createdAt: "desc" }
    });
    const activeQueue = await db_js_1.prisma.job.findMany({
        where: {
            status: { in: ["PENDING", "APPROVED", "PRINTING"] }
        },
        select: {
            id: true,
            status: true,
            createdAt: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return (0, http_js_1.ok)(res, (0, job_inspection_service_js_1.enrichJobsWithQueueInfo)(jobs, activeQueue));
};
exports.myJobs = myJobs;
const allJobs = async (_req, res) => {
    const jobs = await db_js_1.prisma.job.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    credits: true
                }
            },
            timeline: {
                orderBy: { createdAt: "asc" }
            }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return (0, http_js_1.ok)(res, (0, job_inspection_service_js_1.enrichJobsWithQueueInfo)(jobs));
};
exports.allJobs = allJobs;
const approve = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const adminUser = req.user;
    try {
        const job = await (0, job_service_js_1.approveJob)(id);
        await db_js_1.prisma.jobTimelineEvent.create({
            data: {
                jobId: job.id,
                status: "APPROVED",
                label: "Approved",
                actorUserId: adminUser?.id
            }
        });
        if (adminUser) {
            await (0, audit_service_js_1.logAudit)(adminUser.id, client_1.AuditAction.JOB_STATUS_UPDATED, "Job", job.id, {
                toStatus: "APPROVED"
            });
        }
        await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
            userId: job.userId,
            userEmail: job.user.email,
            jobId: job.id,
            type: "JOB_STATUS_CHANGED",
            title: "Request approved",
            message: `Your request "${job.title}" has been approved.`,
            notifyEmail: true
        });
        return (0, http_js_1.ok)(res, job, "Job approved and credits deducted");
    }
    catch (error) {
        return (0, http_js_1.fail)(res, 400, error.message);
    }
};
exports.approve = approve;
const reject = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const adminUser = req.user;
    const { adminNotes } = req.body;
    try {
        const job = await (0, job_service_js_1.rejectJob)(id, adminNotes);
        await db_js_1.prisma.jobTimelineEvent.create({
            data: {
                jobId: job.id,
                status: "REJECTED",
                label: "Rejected",
                notes: adminNotes,
                actorUserId: adminUser?.id
            }
        });
        if (adminUser) {
            await (0, audit_service_js_1.logAudit)(adminUser.id, client_1.AuditAction.JOB_STATUS_UPDATED, "Job", job.id, {
                toStatus: "REJECTED",
                adminNotes
            });
        }
        await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
            userId: job.userId,
            userEmail: job.user.email,
            jobId: job.id,
            type: "JOB_STATUS_CHANGED",
            title: "Request rejected",
            message: `Your request "${job.title}" was rejected.${adminNotes ? ` Notes: ${adminNotes}` : ""}`,
            notifyEmail: true
        });
        return (0, http_js_1.ok)(res, job, "Job rejected");
    }
    catch (error) {
        return (0, http_js_1.fail)(res, 400, error.message);
    }
};
exports.reject = reject;
const patchStatus = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const { status, adminNotes } = req.body;
    if (!status || !Object.values(client_1.JobStatus).includes(status)) {
        return (0, http_js_1.fail)(res, 400, "Invalid status");
    }
    const adminUser = req.user;
    try {
        const updated = await (0, job_service_js_1.updateJobStatus)(id, status, adminNotes);
        await db_js_1.prisma.jobTimelineEvent.create({
            data: {
                jobId: updated.id,
                status,
                label: `Status updated to ${statusLabel[status]}`,
                notes: adminNotes,
                actorUserId: adminUser?.id
            }
        });
        if (adminUser) {
            await (0, audit_service_js_1.logAudit)(adminUser.id, client_1.AuditAction.JOB_STATUS_UPDATED, "Job", updated.id, {
                toStatus: status,
                adminNotes
            });
        }
        await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
            userId: updated.userId,
            userEmail: updated.user.email,
            jobId: updated.id,
            type: "JOB_STATUS_CHANGED",
            title: "Request status updated",
            message: `Your request "${updated.title}" is now ${statusLabel[status]}.${adminNotes ? ` Notes: ${adminNotes}` : ""}`,
            notifyEmail: true
        });
        return (0, http_js_1.ok)(res, updated, "Job status updated");
    }
    catch (error) {
        return (0, http_js_1.fail)(res, 400, error.message);
    }
};
exports.patchStatus = patchStatus;
const patchEstimate = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const { filamentGrams } = req.body;
    if (!filamentGrams || filamentGrams < 1) {
        return (0, http_js_1.fail)(res, 400, "filamentGrams must be at least 1");
    }
    const updated = await (0, job_service_js_1.adjustEstimate)(id, filamentGrams, env_js_1.env.creditPerGram);
    return (0, http_js_1.ok)(res, updated, "Estimate updated");
};
exports.patchEstimate = patchEstimate;
const analyticsSummary = async (_req, res) => {
    const jobs = await db_js_1.prisma.job.findMany({
        select: {
            status: true,
            filamentGrams: true,
            userId: true
        }
    });
    const totalFilamentUsed = jobs
        .filter((job) => ["APPROVED", "PRINTING", "COMPLETED"].includes(job.status))
        .reduce((sum, job) => sum + job.filamentGrams, 0);
    const activeJobs = jobs.filter((job) => ["PENDING", "APPROVED", "PRINTING"].includes(job.status)).length;
    const userCounts = new Map();
    for (const job of jobs) {
        userCounts.set(job.userId, (userCounts.get(job.userId) ?? 0) + 1);
    }
    return (0, http_js_1.ok)(res, {
        totalFilamentUsed,
        activeJobs,
        totalJobs: jobs.length,
        topUsersByJobs: [...userCounts.entries()]
            .map(([userId, count]) => ({ userId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    });
};
exports.analyticsSummary = analyticsSummary;
const downloadJobFile = async (req, res) => {
    const user = req.user;
    if (!user) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const job = await db_js_1.prisma.job.findUnique({
        where: { id },
        select: {
            id: true,
            userId: true,
            fileName: true,
            fileUrl: true
        }
    });
    if (!job) {
        return (0, http_js_1.fail)(res, 404, "Job not found");
    }
    if (user.role !== "ADMIN" && user.id !== job.userId) {
        return (0, http_js_1.fail)(res, 403, "Not allowed to access this file");
    }
    const downloaded = await (0, storage_service_js_1.downloadStoredFile)(job.fileName, job.fileUrl);
    if (!downloaded) {
        return (0, http_js_1.fail)(res, 404, "File not found on server");
    }
    if (downloaded.contentType) {
        res.type(downloaded.contentType);
    }
    res.attachment(job.fileName);
    return res.send(downloaded.buffer);
};
exports.downloadJobFile = downloadJobFile;
const deleteJob = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    const job = await db_js_1.prisma.job.findUnique({
        where: { id },
        select: { id: true, fileName: true, fileUrl: true, userId: true, title: true, user: { select: { email: true } } }
    });
    if (!job) {
        return (0, http_js_1.fail)(res, 404, "Job not found");
    }
    await db_js_1.prisma.$transaction(async (tx) => {
        await tx.creditTransaction.deleteMany({ where: { jobId: id } });
        await tx.job.delete({ where: { id } });
    });
    await (0, storage_service_js_1.deleteStoredFile)(job.fileName, job.fileUrl);
    if (req.user) {
        await (0, audit_service_js_1.logAudit)(req.user.id, client_1.AuditAction.JOB_DELETED, "Job", job.id, {
            title: job.title
        });
    }
    await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
        userId: job.userId,
        userEmail: job.user.email,
        jobId: job.id,
        type: "JOB_STATUS_CHANGED",
        title: "Request deleted",
        message: `Your request "${job.title}" was removed by a manager.`,
        notifyEmail: true
    });
    return (0, http_js_1.ok)(res, { id }, "Job deleted");
};
exports.deleteJob = deleteJob;
