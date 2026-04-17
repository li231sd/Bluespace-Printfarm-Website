"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (err, _req, res, _next) => {
    const status = err.status ?? 500;
    const message = err.message || "Unexpected server error";
    return res.status(status).json({ error: message });
};
exports.errorMiddleware = errorMiddleware;
