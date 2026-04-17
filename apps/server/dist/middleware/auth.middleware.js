"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const http_js_1 = require("../utils/http.js");
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!token) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_js_1.env.jwtSecret);
        req.user = payload;
        return next();
    }
    catch {
        return (0, http_js_1.fail)(res, 401, "Invalid token");
    }
};
exports.requireAuth = requireAuth;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, http_js_1.fail)(res, 401, "Authentication required");
        }
        if (req.user.role !== role) {
            return (0, http_js_1.fail)(res, 403, "Insufficient permissions");
        }
        return next();
    };
};
exports.requireRole = requireRole;
