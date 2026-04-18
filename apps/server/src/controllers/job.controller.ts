import { JobStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { adjustEstimate, approveJob, rejectJob, updateJobStatus } from "../services/job.service.js";
import { deleteStoredFile, downloadStoredFile, uploadFileToStorage } from "../services/storage.service.js";
import { fail, ok, created } from "../utils/http.js";

const estimateFilamentGrams = (fileSizeBytes: number) => {
	// Conservative heuristic calibrated to avoid underestimating lightweight parts.
	const gramsFromFileSize = Math.ceil(fileSizeBytes / Math.max(1, env.autoEstimateBytesPerGram));
	return Math.max(env.minimumFilamentGrams, gramsFromFileSize);
};

export const createJob = async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		return fail(res, 401, "Authentication required");
	}

	const { title, description, fileSize, fileUrl, fileName } = req.body as {
		title?: string;
		description?: string;
		fileSize?: number;
		fileUrl?: string;
		fileName?: string;
	};

	if (!title || !fileName || !fileUrl || !fileSize || fileSize < 1) {
		return fail(res, 400, "Missing required job fields");
	}

	const filamentGrams = estimateFilamentGrams(fileSize);

	const creditCost = Math.ceil(filamentGrams * env.creditPerGram);

	const job = await prisma.job.create({
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

	return created(res, job, "Submission created and pending review");
};

export const uploadJobFile = async (req: Request, res: Response) => {
	if (!req.file) {
		return fail(res, 400, "No file uploaded");
	}

	const uploaded = await uploadFileToStorage(req.file);

	return created(
		res,
		uploaded,
		"File uploaded"
	);
};

export const myJobs = async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		return fail(res, 401, "Authentication required");
	}

	const jobs = await prisma.job.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" }
	});

	return ok(res, jobs);
};

export const allJobs = async (_req: Request, res: Response) => {
	const jobs = await prisma.job.findMany({
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
		orderBy: [{ createdAt: "asc" }, { id: "asc" }]
	});

	return ok(res, jobs);
};

export const approve = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}
	try {
		const job = await approveJob(id);
		return ok(res, job, "Job approved and credits deducted");
	} catch (error) {
		return fail(res, 400, (error as Error).message);
	}
};

export const reject = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}
	const { adminNotes } = req.body as { adminNotes?: string };

	try {
		const job = await rejectJob(id, adminNotes);
		return ok(res, job, "Job rejected");
	} catch (error) {
		return fail(res, 400, (error as Error).message);
	}
};

export const patchStatus = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}
	const { status, adminNotes } = req.body as { status?: JobStatus; adminNotes?: string };
	if (!status || !Object.values(JobStatus).includes(status)) {
		return fail(res, 400, "Invalid status");
	}

	try {
		const updated = await updateJobStatus(id, status, adminNotes);
		return ok(res, updated, "Job status updated");
	} catch (error) {
		return fail(res, 400, (error as Error).message);
	}
};

export const patchEstimate = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}
	const { filamentGrams } = req.body as { filamentGrams?: number };
	if (!filamentGrams || filamentGrams < 1) {
		return fail(res, 400, "filamentGrams must be at least 1");
	}

	const updated = await adjustEstimate(id, filamentGrams, env.creditPerGram);
	return ok(res, updated, "Estimate updated");
};

export const analyticsSummary = async (_req: Request, res: Response) => {
	const jobs = await prisma.job.findMany({
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

	const userCounts = new Map<string, number>();
	for (const job of jobs) {
		userCounts.set(job.userId, (userCounts.get(job.userId) ?? 0) + 1);
	}

	return ok(res, {
		totalFilamentUsed,
		activeJobs,
		totalJobs: jobs.length,
		topUsersByJobs: [...userCounts.entries()]
			.map(([userId, count]) => ({ userId, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5)
	});
};

export const downloadJobFile = async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		return fail(res, 401, "Authentication required");
	}

	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}

	const job = await prisma.job.findUnique({
		where: { id },
		select: {
			id: true,
			userId: true,
			fileName: true,
			fileUrl: true
		}
	});

	if (!job) {
		return fail(res, 404, "Job not found");
	}

	if (user.role !== "ADMIN" && user.id !== job.userId) {
		return fail(res, 403, "Not allowed to access this file");
	}

	const downloaded = await downloadStoredFile(job.fileName, job.fileUrl);
	if (!downloaded) {
		return fail(res, 404, "File not found on server");
	}

	if (downloaded.contentType) {
		res.type(downloaded.contentType);
	}
	res.attachment(job.fileName);
	return res.send(downloaded.buffer);
};

export const deleteJob = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}

	const job = await prisma.job.findUnique({
		where: { id },
		select: { id: true, fileName: true, fileUrl: true }
	});

	if (!job) {
		return fail(res, 404, "Job not found");
	}

	await prisma.$transaction(async (tx) => {
		await tx.creditTransaction.deleteMany({ where: { jobId: id } });
		await tx.job.delete({ where: { id } });
	});

	await deleteStoredFile(job.fileName, job.fileUrl);

	return ok(res, { id }, "Job deleted");
};
