"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAdjustCredits = exports.myCredits = void 0;
const db_js_1 = require("../config/db.js");
const audit_service_js_1 = require("../services/audit.service.js");
const credit_service_js_1 = require("../services/credit.service.js");
const notification_service_js_1 = require("../services/notification.service.js");
const http_js_1 = require("../utils/http.js");
const myCredits = async (req, res) => {
    const user = req.user;
    if (!user) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const account = await db_js_1.prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            credits: true,
            name: true,
            email: true
        }
    });
    if (!account) {
        return (0, http_js_1.fail)(res, 404, "User not found");
    }
    const history = await (0, credit_service_js_1.getCreditHistory)(user.id);
    return (0, http_js_1.ok)(res, {
        user: account,
        history
    });
};
exports.myCredits = myCredits;
const adminAdjustCredits = async (req, res) => {
    const authUser = req.user;
    if (!authUser) {
        return (0, http_js_1.fail)(res, 401, "Authentication required");
    }
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || !reason) {
        return (0, http_js_1.fail)(res, 400, "userId, amount, and reason are required");
    }
    const updated = await (0, credit_service_js_1.adjustCredits)(userId, amount, reason);
    await (0, audit_service_js_1.logAudit)(authUser.id, "CREDIT_ADJUSTED", "User", userId, {
        amount,
        reason
    });
    await (0, notification_service_js_1.createUserNotification)(db_js_1.prisma, {
        userId,
        userEmail: updated.email,
        type: "CREDIT_UPDATED",
        title: "Credits updated",
        message: `Your credits were updated by ${amount > 0 ? `+${amount}` : amount}. Reason: ${reason}`,
        notifyEmail: true
    });
    return (0, http_js_1.ok)(res, updated, "Credits updated");
};
exports.adminAdjustCredits = adminAdjustCredits;
