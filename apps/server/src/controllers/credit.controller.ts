import { Request, Response } from "express";
import { prisma } from "../config/db.js";
import { adjustCredits, getCreditHistory } from "../services/credit.service.js";
import { fail, ok } from "../utils/http.js";

export const myCredits = async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		return fail(res, 401, "Authentication required");
	}

	const account = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			credits: true,
			name: true,
			email: true
		}
	});

	if (!account) {
		return fail(res, 404, "User not found");
	}

	const history = await getCreditHistory(user.id);
	return ok(res, {
		user: account,
		history
	});
};

export const adminAdjustCredits = async (req: Request, res: Response) => {
	const { userId, amount, reason } = req.body as {
		userId?: string;
		amount?: number;
		reason?: string;
	};

	if (!userId || !amount || !reason) {
		return fail(res, 400, "userId, amount, and reason are required");
	}

	const updated = await adjustCredits(userId, amount, reason);
	return ok(res, updated, "Credits updated");
};
