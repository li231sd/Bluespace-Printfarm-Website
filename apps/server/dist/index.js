"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const env_js_1 = require("./config/env.js");
const error_middleware_js_1 = require("./middleware/error.middleware.js");
const credit_routes_js_1 = __importDefault(require("./routes/credit.routes.js"));
const job_routes_js_1 = __importDefault(require("./routes/job.routes.js"));
const user_routes_js_1 = __importDefault(require("./routes/user.routes.js"));
const storage_service_js_1 = require("./services/storage.service.js");
const virus_scan_service_js_1 = require("./services/virus-scan.service.js");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: env_js_1.env.webOrigin }));
app.use(express_1.default.json({ limit: "2mb" }));
const uploadDir = (0, storage_service_js_1.resolveUploadDir)();
app.use("/uploads", express_1.default.static(uploadDir));
app.get("/uploads/:fileName", (req, res, next) => {
    const requested = Array.isArray(req.params.fileName) ? req.params.fileName[0] : req.params.fileName;
    if (!requested) {
        return next();
    }
    const safeRequested = node_path_1.default.basename(requested);
    if (safeRequested !== requested) {
        return res.status(400).json({ error: "Invalid file path" });
    }
    const absolute = (0, storage_service_js_1.resolveStoredFilePath)(safeRequested);
    if (absolute) {
        return res.sendFile(absolute);
    }
    return next();
});
app.get("/health", (_req, res) => {
    const scanStatus = (0, virus_scan_service_js_1.getVirusScanningSatus)();
    res.json({
        ok: true,
        service: "3d-print-platform-server",
        scanning: scanStatus.enabled ? `${scanStatus.status}` : "disabled"
    });
});
app.use("/api/users", user_routes_js_1.default);
app.use("/api/jobs", job_routes_js_1.default);
app.use("/api/credits", credit_routes_js_1.default);
app.use(error_middleware_js_1.errorMiddleware);
app.listen(env_js_1.env.port, () => {
    console.log(`API server running on http://localhost:${env_js_1.env.port}`);
});
