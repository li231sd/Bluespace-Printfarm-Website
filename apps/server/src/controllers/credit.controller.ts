import { Request, Response } from "express";
import { prisma } from "../config/db.js";
import { logAudit } from "../services/audit.service.js";
import { adjustCredits, getCreditHistory } from "../services/credit.service.js";
import { createUserNotification } from "../services/notification.service.js";
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
	const authUser = req.user;
	if (!authUser) {
		return fail(res, 401, "Authentication required");
	}

	const { userId, amount, reason } = req.body as {
		userId?: string;
		amount?: number;
		reason?: string;
	};

	if (!userId || !amount || !reason) {
		return fail(res, 400, "userId, amount, and reason are required");
	}

	const updated = await adjustCredits(userId, amount, reason);

	await logAudit(authUser.id, "CREDIT_ADJUSTED", "User", userId, {
		amount,
		reason
	});

	await createUserNotification(prisma, {
		userId,
		userEmail: updated.email,
		type: "CREDIT_UPDATED",
		title: "Credits updated",
		message: `Your credits were updated by ${amount > 0 ? `+${amount}` : amount}. Reason: ${reason}`,
		notifyEmail: true
	});

	return ok(res, updated, "Credits updated");
};
