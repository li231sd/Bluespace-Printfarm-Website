"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuditLogs = exports.deleteNotification = exports.markNotificationRead = exports.myNotifications = exports.deleteUser = exports.participants = exports.topUsers = exports.me = exports.login = exports.signup = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const db_js_1 = require("../config/db.js");
const env_js_1 = require("../config/env.js");
const audit_service_js_1 = require("../services/audit.service.js");
const storage_service_js_1 = require("../services/storage.service.js");
const http_js_1 = require("../utils/http.js");
const signToken = (id, email, role) => {
    return jsonwebtoken_1.default.sign({ id, email, role }, env_js_1.env.jwtSecret, { expiresIn: "7d" });
};
const signup = async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !password || password.length < 8) {
        return (0, http_js_1.fail)(res, 400, "Valid email and password (min 8 chars) are required");
    }
    const existing = await db_js_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        return (0, http_js_1.fail)(res, 409, "User already exists");
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const role = email === env_js_1.env.adminEmail ? "ADMIN" : "USER";
    const user = await db_js_1.prisma.user.create({
        data: {
            email,
            name: name?.trim() || email.split("@")[0],
            passwordHash,
            role
        }
    });
    const token = signToken(user.id, user.email, user.role);
    return (0, http_js_1.created)(res, {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            credits: user.credits
        }
    }, "Account created");
};
exports.signup = signup;
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return (0, http_js_1.fail)(res, 400, "Email and password are required");
    }
    const user = await db_js_1.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
        return (0, http_js_1.fail)(res, 401, "Invalid credentials");
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        return (0, http_js_1.fail)(res, 401, "Invalid credentials");
    }
    const token = signToken(user.id, user.email, user.role);
    return (0, http_js_1.ok)(res, {
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
exports.login = login;
const me = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const user = await db_js_1.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, email: true, name: true, role: true, credits: true, createdAt: true }
    });
    if (!user) {
        return (0, http_js_1.fail)(res, 404, "User not found");
    }
    return (0, http_js_1.ok)(res, user);
};
exports.me = me;
const topUsers = async (_req, res) => {
    const users = await db_js_1.prisma.user.findMany({
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
    return (0, http_js_1.ok)(res, users);
};
exports.topUsers = topUsers;
const participants = async (_req, res) => {
    const users = await db_js_1.prisma.user.findMany({
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
    return (0, http_js_1.ok)(res, users);
};
exports.participants = participants;
const deleteUser = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing user id");
    }
    if (authUser.id === id) {
        return (0, http_js_1.fail)(res, 400, "You cannot delete your own account");
    }
    const user = await db_js_1.prisma.user.findUnique({
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
        return (0, http_js_1.fail)(res, 404, "User not found");
    }
    if (user.role === "ADMIN") {
        return (0, http_js_1.fail)(res, 400, "Admin users cannot be deleted");
    }
    const jobIds = user.jobs.map((job) => job.id);
    await db_js_1.prisma.$transaction(async (tx) => {
        if (jobIds.length > 0) {
            await tx.creditTransaction.deleteMany({
                where: {
                    OR: [{ jobId: { in: jobIds } }, { userId: id }]
                }
            });
            await tx.job.deleteMany({ where: { id: { in: jobIds } } });
        }
        else {
            await tx.creditTransaction.deleteMany({ where: { userId: id } });
        }
        await tx.user.delete({ where: { id } });
    });
    await (0, audit_service_js_1.logAudit)(authUser.id, "USER_DELETED", "User", id, {
        deletedJobCount: jobIds.length
    });
    for (const job of user.jobs) {
        await (0, storage_service_js_1.deleteStoredFile)(job.fileName, job.fileUrl || "");
    }
    return (0, http_js_1.ok)(res, { id }, "User deleted");
};
exports.deleteUser = deleteUser;
const myNotifications = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const notifications = await db_js_1.prisma.notification.findMany({
        where: {
            userId: authUser.id,
            channel: client_1.NotificationChannel.IN_APP
        },
        orderBy: { createdAt: "desc" },
        take: 100
    });
    return (0, http_js_1.ok)(res, notifications);
};
exports.myNotifications = myNotifications;
const markNotificationRead = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing notification id");
    }
    const notification = await db_js_1.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== authUser.id) {
        return (0, http_js_1.fail)(res, 404, "Notification not found");
    }
    const updated = await db_js_1.prisma.notification.update({
        where: { id },
        data: {
            readAt: notification.readAt ?? new Date()
        }
    });
    return (0, http_js_1.ok)(res, updated);
};
exports.markNotificationRead = markNotificationRead;
const deleteNotification = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
        return (0, http_js_1.fail)(res, 400, "Missing notification id");
    }
    const notification = await db_js_1.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== authUser.id) {
        return (0, http_js_1.fail)(res, 404, "Notification not found");
    }
    await db_js_1.prisma.notification.delete({ where: { id } });
    return (0, http_js_1.ok)(res, { id }, "Notification deleted");
};
exports.deleteNotification = deleteNotification;
const adminAuditLogs = async (_req, res) => {
    const logs = await db_js_1.prisma.auditLog.findMany({
        include: {
            adminUser: {
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            }
        },
        orderBy: { createdAt: "desc" },
        take: 200
    });
    return (0, http_js_1.ok)(res, logs);
};
exports.adminAuditLogs = adminAuditLogs;
