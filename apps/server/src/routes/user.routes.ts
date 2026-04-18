import { Router } from "express";
import {
	adminAuditLogs,
	deleteNotification,
	deleteUser,
	login,
	markNotificationRead,
	me,
	myNotifications,
	participants,
	signup,
	topUsers
} from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.get("/notifications", requireAuth, asyncHandler(myNotifications));
router.patch("/notifications/:id/read", requireAuth, asyncHandler(markNotificationRead));
router.delete("/notifications/:id", requireAuth, asyncHandler(deleteNotification));
router.get("/top", requireAuth, requireRole("ADMIN"), asyncHandler(topUsers));
router.get("/participants", requireAuth, requireRole("ADMIN"), asyncHandler(participants));
router.get("/audit-logs", requireAuth, requireRole("ADMIN"), asyncHandler(adminAuditLogs));
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(deleteUser));

export default router;
