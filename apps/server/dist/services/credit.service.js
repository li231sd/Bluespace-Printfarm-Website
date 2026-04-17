"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreditHistory = exports.adjustCredits = void 0;
const db_js_1 = require("../config/db.js");
const adjustCredits = async (userId, amount, reason, jobId) => {
    return db_js_1.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { credits: { increment: amount } }
        });
        await tx.creditTransaction.create({
            data: {
                userId,
                amount,
                reason,
                jobId
            }
        });
        return updatedUser;
    });
};
exports.adjustCredits = adjustCredits;
const getCreditHistory = async (userId) => {
    return db_js_1.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50
    });
};
exports.getCreditHistory = getCreditHistory;
