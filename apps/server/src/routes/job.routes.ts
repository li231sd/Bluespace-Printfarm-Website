import { Router } from "express";
import {
	allJobs,
	analyticsSummary,
	approve,
	createJob,
	deleteJob,
	downloadJobFile,
	myJobs,
	patchEstimate,
	patchStatus,
	reject,
	uploadJobFile
} from "../controllers/job.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { upload } from "../services/storage.service.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.post("/upload", requireAuth, upload.single("file"), asyncHandler(uploadJobFile));
router.post("/", requireAuth, asyncHandler(createJob));
router.get("/mine", requireAuth, asyncHandler(myJobs));
router.get("/:id/download", requireAuth, asyncHandler(downloadJobFile));

router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(allJobs));
router.get("/analytics/summary", requireAuth, requireRole("ADMIN"), asyncHandler(analyticsSummary));
router.patch("/:id/approve", requireAuth, requireRole("ADMIN"), asyncHandler(approve));
router.patch("/:id/reject", requireAuth, requireRole("ADMIN"), asyncHandler(reject));
router.patch("/:id/status", requireAuth, requireRole("ADMIN"), asyncHandler(patchStatus));
router.patch("/:id/estimate", requireAuth, requireRole("ADMIN"), asyncHandler(patchEstimate));
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(deleteJob));

export default router;
