import { Router } from "express";
import { deleteUser, login, me, participants, signup, topUsers } from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.get("/top", requireAuth, requireRole("ADMIN"), asyncHandler(topUsers));
router.get("/participants", requireAuth, requireRole("ADMIN"), asyncHandler(participants));
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(deleteUser));

export default router;
