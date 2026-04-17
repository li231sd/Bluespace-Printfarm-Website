import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { fail } from "../utils/http.js";

export type AuthUser = {
	id: string;
	email: string;
	role: "USER" | "ADMIN";
};

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
	const authHeader = req.headers.authorization;
	const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

	if (!token) {
		return fail(res, 401, "Authentication required");
	}

	try {
		const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
		req.user = payload;
		return next();
	} catch {
		return fail(res, 401, "Invalid token");
	}
};

export const requireRole = (role: "USER" | "ADMIN") => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return fail(res, 401, "Authentication required");
		}

		if (req.user.role !== role) {
			return fail(res, 403, "Insufficient permissions");
		}

		return next();
	};
};
