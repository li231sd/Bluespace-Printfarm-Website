import { AuditAction, JobStatus, NotificationType } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logAudit } from "../services/audit.service.js";
import {
	buildNeedsAttentionFlags,
	enrichJobsWithQueueInfo,
	inspectModelFile
} from "../services/job-inspection.service.js";
import { adjustEstimate, approveJob, rejectJob, updateJobStatus } from "../services/job.service.js";
import { createUserNotification } from "../services/notification.service.js";
import { deleteStoredFile, downloadStoredFile, uploadFileToStorage } from "../services/storage.service.js";
import { scanFileWithVirusTotal } from "../services/virus-scan.service.js";
import { fail, ok, created } from "../utils/http.js";

const estimateFilamentGrams = (fileSizeBytes: number) => {
	// Conservative heuristic calibrated to avoid underestimating lightweight parts.
	const gramsFromFileSize = Math.ceil(fileSizeBytes / Math.max(1, env.autoEstimateBytesPerGram));
	return Math.max(env.minimumFilamentGrams, gramsFromFileSize);
};

const statusLabel: Record<JobStatus, string> = {
	PENDING: "pending review",
	APPROVED: "approved",
	PRINTING: "printing",
	COMPLETED: "completed",
	REJECTED: "rejected"
};

const notifyAdmins = async (input: {
	jobId?: string;
	type: NotificationType;
	title: string;
	message: string;
	notifyEmail?: boolean;
}) => {
	const admins = await prisma.user.findMany({
		where: { role: "ADMIN" },
		select: {
			id: true,
			email: true
		}
	});

	await Promise.all(
		admins.map((admin) =>
			createUserNotification(prisma, {
				userId: admin.id,
				userEmail: admin.email,
				jobId: input.jobId,
				type: input.type,
				title: input.title,
				message: input.message,
				notifyEmail: input.notifyEmail
			})
		)
	);
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

	const account = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			email: true,
			credits: true
		}
	});

	if (!account) {
		return fail(res, 404, "User not found");
	}

	const filamentGrams = estimateFilamentGrams(fileSize);
	const creditCost = Math.ceil(filamentGrams * env.creditPerGram);
	const modelInspection = await inspectModelFile(fileName, fileUrl);
	const needsAttentionFlags = buildNeedsAttentionFlags({
		fileFlags: modelInspection.flags,
		hasUnclearSpecs: !description || description.trim().length < 12,
		hasCreditIssue: account.credits < creditCost
	});

	const job = await prisma.$transaction(async (tx) => {
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

	// Scan file with VirusTotal if enabled
	if (env.enableVirusScan && env.virusTotalApiKey) {
		try {
			// Get the actual file path for scanning
			const { resolveStoredFilePath } = await import("../services/storage.service.js");
			const filePath = resolveStoredFilePath(fileName);

			if (filePath) {
				const scanResult = await scanFileWithVirusTotal(filePath);
				
				// Update job with scan results
				await prisma.job.update({
					where: { id: job.id },
					data: {
						virusScanId: scanResult.scanId,
						virusClean: scanResult.isClean,
						virusThreats: scanResult.threat,
						virusSeverity: scanResult.threatSeverity,
						virusDetectionRatio: scanResult.detectionRatio,
						virusScanDate: scanResult.scanDate ? new Date(scanResult.scanDate) : null
					}
				});

				// Add virus threat flag if file is not clean
				if (!scanResult.isClean && scanResult.threat) {
					const updatedNeedsAttentionFlags = [...needsAttentionFlags, `virus_threat: ${scanResult.threat}`];
					await prisma.job.update({
						where: { id: job.id },
						data: { needsAttentionFlags: updatedNeedsAttentionFlags }
					});

					// Notify admins of virus threat
					await notifyAdmins({
						jobId: job.id,
						type: "JOB_NEEDS_ATTENTION",
						title: "Security Alert: Potential Malware Detected",
						message: `Job "${job.title}" failed virus scan. Threat: ${scanResult.threat}. Detection ratio: ${scanResult.detectionRatio || 'unknown'}.`,
						notifyEmail: true
					});
				}
			}
		} catch (error) {
			console.error("Virus scan error:", error);
			// Log error but don't block job creation
		}
	}

	await createUserNotification(prisma, {
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
		await createUserNotification(prisma, {
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

	return created(
		res,
		{
			...job,
			preflightWarnings: modelInspection.warnings
		},
		"Submission created and pending review"
	);
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
		include: {
			timeline: {
				orderBy: { createdAt: "asc" }
			}
		},
		orderBy: { createdAt: "desc" }
	});

	const activeQueue = await prisma.job.findMany({
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

	return ok(res, enrichJobsWithQueueInfo(jobs, activeQueue));
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
			},
			timeline: {
				orderBy: { createdAt: "asc" }
			}
		},
		orderBy: [{ createdAt: "asc" }, { id: "asc" }]
	});

	return ok(res, enrichJobsWithQueueInfo(jobs));
};

export const approve = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing job id");
	}
	const adminUser = req.user;
	try {
		const job = await approveJob(id);

		await prisma.jobTimelineEvent.create({
			data: {
				jobId: job.id,
				status: "APPROVED",
				label: "Approved",
				actorUserId: adminUser?.id
			}
		});

		if (adminUser) {
			await logAudit(adminUser.id, AuditAction.JOB_STATUS_UPDATED, "Job", job.id, {
				toStatus: "APPROVED"
			});
		}

		await createUserNotification(prisma, {
			userId: job.userId,
			userEmail: job.user.email,
			jobId: job.id,
			type: "JOB_STATUS_CHANGED",
			title: "Request approved",
			message: `Your request "${job.title}" has been approved.`,
			notifyEmail: true
		});

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
	const adminUser = req.user;
	const { adminNotes } = req.body as { adminNotes?: string };

	try {
		const job = await rejectJob(id, adminNotes);

		await prisma.jobTimelineEvent.create({
			data: {
				jobId: job.id,
				status: "REJECTED",
				label: "Rejected",
				notes: adminNotes,
				actorUserId: adminUser?.id
			}
		});

		if (adminUser) {
			await logAudit(adminUser.id, AuditAction.JOB_STATUS_UPDATED, "Job", job.id, {
				toStatus: "REJECTED",
				adminNotes
			});
		}

		await createUserNotification(prisma, {
			userId: job.userId,
			userEmail: job.user.email,
			jobId: job.id,
			type: "JOB_STATUS_CHANGED",
			title: "Request rejected",
			message: `Your request "${job.title}" was rejected.${adminNotes ? ` Notes: ${adminNotes}` : ""}`,
			notifyEmail: true
		});

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
	const adminUser = req.user;

	try {
		const updated = await updateJobStatus(id, status, adminNotes);

		await prisma.jobTimelineEvent.create({
			data: {
				jobId: updated.id,
				status,
				label: `Status updated to ${statusLabel[status]}`,
				notes: adminNotes,
				actorUserId: adminUser?.id
			}
		});

		if (adminUser) {
			await logAudit(adminUser.id, AuditAction.JOB_STATUS_UPDATED, "Job", updated.id, {
				toStatus: status,
				adminNotes
			});
		}

		await createUserNotification(prisma, {
			userId: updated.userId,
			userEmail: updated.user.email,
			jobId: updated.id,
			type: "JOB_STATUS_CHANGED",
			title: "Request status updated",
			message: `Your request "${updated.title}" is now ${statusLabel[status]}.${adminNotes ? ` Notes: ${adminNotes}` : ""}`,
			notifyEmail: true
		});

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
		select: { id: true, fileName: true, fileUrl: true, userId: true, title: true, user: { select: { email: true } } }
	});

	if (!job) {
		return fail(res, 404, "Job not found");
	}

	await prisma.$transaction(async (tx) => {
		await tx.creditTransaction.deleteMany({ where: { jobId: id } });
		await tx.job.delete({ where: { id } });
	});

	await deleteStoredFile(job.fileName, job.fileUrl);

	if (req.user) {
		await logAudit(req.user.id, AuditAction.JOB_DELETED, "Job", job.id, {
			title: job.title
		});
	}

	await createUserNotification(prisma, {
		userId: job.userId,
		userEmail: job.user.email,
		jobId: job.id,
		type: "JOB_STATUS_CHANGED",
		title: "Request deleted",
		message: `Your request "${job.title}" was removed by a manager.`,
		notifyEmail: true
	});

	return ok(res, { id }, "Job deleted");
};
