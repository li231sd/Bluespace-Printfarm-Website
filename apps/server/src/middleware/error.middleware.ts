import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction
) => {
	const status = (err as Error & { status?: number }).status ?? 500;
	const message = err.message || "Unexpected server error";
	return res.status(status).json({ error: message });
};
