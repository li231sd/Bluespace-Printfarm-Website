import cors from "cors";
import express from "express";
import path from "node:path";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import creditRoutes from "./routes/credit.routes.js";
import jobRoutes from "./routes/job.routes.js";
import userRoutes from "./routes/user.routes.js";
import { resolveStoredFilePath, resolveUploadDir } from "./services/storage.service.js";
import { getVirusScanningSatus } from "./services/virus-scan.service.js";

const app = express();

app.use(cors({ origin: env.webOrigin }));
app.use(express.json({ limit: "2mb" }));

const uploadDir = resolveUploadDir();
app.use("/uploads", express.static(uploadDir));

app.get("/uploads/:fileName", (req, res, next) => {
	const requested = Array.isArray(req.params.fileName) ? req.params.fileName[0] : req.params.fileName;
	if (!requested) {
		return next();
	}

	const safeRequested = path.basename(requested);
	if (safeRequested !== requested) {
		return res.status(400).json({ error: "Invalid file path" });
	}

	const absolute = resolveStoredFilePath(safeRequested);
	if (absolute) {
		return res.sendFile(absolute);
	}

	return next();
});

app.get("/health", (_req, res) => {
	const scanStatus = getVirusScanningSatus();
	res.json({
		ok: true,
		service: "3d-print-platform-server",
		scanning: scanStatus.enabled ? `${scanStatus.status}` : "disabled"
	});
});

app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/credits", creditRoutes);

app.use(errorMiddleware);

app.listen(env.port, () => {
	console.log(`API server running on http://localhost:${env.port}`);
});
