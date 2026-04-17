import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { deleteStoredFile } from "../services/storage.service.js";
import { fail, ok, created } from "../utils/http.js";

const signToken = (id: string, email: string, role: "USER" | "ADMIN") => {
	return jwt.sign({ id, email, role }, env.jwtSecret, { expiresIn: "7d" });
};

export const signup = async (req: Request, res: Response) => {
	const { email, name, password } = req.body as {
		email?: string;
		name?: string;
		password?: string;
	};

	if (!email || !password || password.length < 8) {
		return fail(res, 400, "Valid email and password (min 8 chars) are required");
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return fail(res, 409, "User already exists");
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const role = email === env.adminEmail ? "ADMIN" : "USER";

	const user = await prisma.user.create({
		data: {
			email,
			name: name?.trim() || email.split("@")[0],
			passwordHash,
			role
		}
	});

	const token = signToken(user.id, user.email, user.role);
	return created(
		res,
		{
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				credits: user.credits
			}
		},
		"Account created"
	);
};

export const login = async (req: Request, res: Response) => {
	const { email, password } = req.body as { email?: string; password?: string };
	if (!email || !password) {
		return fail(res, 400, "Email and password are required");
	}

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user?.passwordHash) {
		return fail(res, 401, "Invalid credentials");
	}

	const valid = await bcrypt.compare(password, user.passwordHash);
	if (!valid) {
		return fail(res, 401, "Invalid credentials");
	}

	const token = signToken(user.id, user.email, user.role);
	return ok(res, {
		token,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			credits: user.credits
		}
	});
};

export const me = async (req: Request, res: Response) => {
	const authUser = req.user;
	if (!authUser) {
		return fail(res, 401, "Authentication required");
	}

	const user = await prisma.user.findUnique({
		where: { id: authUser.id },
		select: { id: true, email: true, name: true, role: true, credits: true, createdAt: true }
	});

	if (!user) {
		return fail(res, 404, "User not found");
	}

	return ok(res, user);
};

export const topUsers = async (_req: Request, res: Response) => {
	const users = await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			credits: true,
			_count: {
				select: {
					jobs: true
				}
			}
		},
		orderBy: {
			jobs: {
				_count: "desc"
			}
		},
		take: 5
	});

	return ok(res, users);
};

export const participants = async (_req: Request, res: Response) => {
	const users = await prisma.user.findMany({
		where: { role: "USER" },
		select: {
			id: true,
			name: true,
			email: true,
			credits: true,
			_count: {
				select: {
					jobs: true
				}
			}
		},
		orderBy: {
			createdAt: "asc"
		}
	});

	return ok(res, users);
};

export const deleteUser = async (req: Request, res: Response) => {
	const authUser = req.user;
	if (!authUser) {
		return fail(res, 401, "Authentication required");
	}

	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	if (!id) {
		return fail(res, 400, "Missing user id");
	}

	if (authUser.id === id) {
		return fail(res, 400, "You cannot delete your own account");
	}

	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			role: true,
			jobs: {
				select: {
					id: true,
					fileName: true,
					fileUrl: true
				}
			}
		}
	});

	if (!user) {
		return fail(res, 404, "User not found");
	}

	if (user.role === "ADMIN") {
		return fail(res, 400, "Admin users cannot be deleted");
	}

	const jobIds = user.jobs.map((job) => job.id);

	await prisma.$transaction(async (tx) => {
		if (jobIds.length > 0) {
			await tx.creditTransaction.deleteMany({
				where: {
					OR: [{ jobId: { in: jobIds } }, { userId: id }]
				}
			});

			await tx.job.deleteMany({ where: { id: { in: jobIds } } });
		} else {
			await tx.creditTransaction.deleteMany({ where: { userId: id } });
		}

		await tx.user.delete({ where: { id } });
	});

	for (const job of user.jobs) {
		await deleteStoredFile(job.fileName, job.fileUrl || "");
	}

	return ok(res, { id }, "User deleted");
};
