import { Router } from "express";
import { adminAdjustCredits, myCredits } from "../controllers/credit.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/mine", requireAuth, asyncHandler(myCredits));
router.post("/adjust", requireAuth, requireRole("ADMIN"), asyncHandler(adminAdjustCredits));

export default router;
