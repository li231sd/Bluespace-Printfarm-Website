"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJob = exports.downloadJobFile = exports.analyticsSummary = exports.patchEstimate = exports.patchStatus = exports.reject = exports.approve = exports.allJobs = exports.myJobs = exports.uploadJobFile = exports.createJob = void 0;
const client_1 = require("@prisma/client");
const db_js_1 = require("../config/db.js");
const env_js_1 = require("../config/env.js");
const job_service_js_1 = require("../services/job.service.js");
const storage_service_js_1 = require("../services/storage.service.js");
const http_js_1 = require("../utils/http.js");
const createJob = async (req, res) => {
    const user = req.user;
    if (!user) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const { title, description, filamentGrams, fileUrl, fileName } = req.body;
    if (!title || !fileName || !fileUrl || !filamentGrams || filamentGrams < 1) {
        return (0, http_js_1.fail)(res, 400, "Missing required job fields");
    }
    const creditCost = Math.ceil(filamentGrams * env_js_1.env.creditPerGram);
    const job = await db_js_1.prisma.job.create({
        data: {
            title,
            description,
            filamentGrams,
            creditCost,
            fileName,
            fileUrl,
            userId: user.id
        }
    });
    return (0, http_js_1.created)(res, job, "Submission created and pending review");
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
        orderBy: { createdAt: "desc" }
    });
    return (0, http_js_1.ok)(res, jobs);
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
            }
        },
        orderBy: { createdAt: "desc" }
    });
    return (0, http_js_1.ok)(res, jobs);
};
exports.allJobs = allJobs;
const approve = async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing job id");
    }
    try {
        const job = await (0, job_service_js_1.approveJob)(id);
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
    const { adminNotes } = req.body;
    try {
        const job = await (0, job_service_js_1.rejectJob)(id, adminNotes);
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
    const updated = await (0, job_service_js_1.updateJobStatus)(id, status, adminNotes);
    return (0, http_js_1.ok)(res, updated, "Job status updated");
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
        select: { id: true, fileName: true, fileUrl: true }
    });
    if (!job) {
        return (0, http_js_1.fail)(res, 404, "Job not found");
    }
    await db_js_1.prisma.$transaction(async (tx) => {
        await tx.creditTransaction.deleteMany({ where: { jobId: id } });
        await tx.job.delete({ where: { id } });
    });
    await (0, storage_service_js_1.deleteStoredFile)(job.fileName, job.fileUrl);
    return (0, http_js_1.ok)(res, { id }, "Job deleted");
};
exports.deleteJob = deleteJob;
