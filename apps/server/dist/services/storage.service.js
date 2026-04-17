"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicFileUrl = exports.upload = exports.deleteStoredFile = exports.downloadStoredFile = exports.uploadFileToStorage = exports.resolveStoredFilePath = exports.resolveUploadDir = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const multer_1 = __importDefault(require("multer"));
const env_js_1 = require("../config/env.js");
const SUPABASE_PREFIX = "supabase://";
const resolveUploadDir = () => {
    const fromCurrent = node_path_1.default.resolve(process.cwd(), env_js_1.env.uploadDir);
    const fromServerPackage = node_path_1.default.resolve(process.cwd(), "../../", env_js_1.env.uploadDir);
    if (node_fs_1.default.existsSync(fromCurrent)) {
        return fromCurrent;
    }
    return fromServerPackage;
};
exports.resolveUploadDir = resolveUploadDir;
const uploadAbsolutePath = (0, exports.resolveUploadDir)();
node_fs_1.default.mkdirSync(uploadAbsolutePath, { recursive: true });
const isSupabaseStorage = () => env_js_1.env.storageMode === "supabase";
const hasSupabaseConfig = () => Boolean(env_js_1.env.supabaseUrl && env_js_1.env.supabaseKey && env_js_1.env.supabaseBucket);
const assertSupabaseConfig = () => {
    const missing = [];
    if (!env_js_1.env.supabaseUrl) {
        missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    }
    if (!env_js_1.env.supabaseKey) {
        missing.push("SUPABASE_KEY");
    }
    if (!env_js_1.env.supabaseBucket) {
        missing.push("SUPABASE_BUCKET");
    }
    if (missing.length === 0 && env_js_1.env.supabaseUrl?.includes("<your-project-ref>")) {
        missing.push("SUPABASE_URL (replace <your-project-ref> with real project ref)");
    }
    if (missing.length === 0) {
        try {
            new URL(env_js_1.env.supabaseUrl || "");
        }
        catch {
            missing.push("SUPABASE_URL (must be a valid https URL)");
        }
    }
    if (missing.length === 0 && hasSupabaseConfig()) {
        return;
    }
    throw new Error(`Supabase storage is not fully configured. Missing: ${missing.join(", ")}`);
};
const buildSupabaseObjectUrl = (bucket, objectKey) => {
    const base = (env_js_1.env.supabaseUrl || "").replace(/\/$/, "");
    return `${base}/storage/v1/object/${bucket}/${encodeURIComponent(objectKey)}`;
};
const parseSupabaseRef = (fileUrl) => {
    if (!fileUrl.startsWith(SUPABASE_PREFIX)) {
        return null;
    }
    const value = fileUrl.slice(SUPABASE_PREFIX.length);
    const slash = value.indexOf("/");
    if (slash <= 0 || slash === value.length - 1) {
        return null;
    }
    return {
        bucket: value.slice(0, slash),
        objectKey: value.slice(slash + 1)
    };
};
const resolveStoredFilePath = (fileName) => {
    const safeFileName = node_path_1.default.basename(fileName);
    if (!safeFileName) {
        return null;
    }
    const candidates = [
        safeFileName,
        safeFileName.replace(/_{3,}/g, "__"),
        safeFileName.replace(/_{2,}/g, "_")
    ];
    for (const candidate of [...new Set(candidates)]) {
        const absolute = node_path_1.default.join(uploadAbsolutePath, candidate);
        if (node_fs_1.default.existsSync(absolute)) {
            return absolute;
        }
    }
    return null;
};
exports.resolveStoredFilePath = resolveStoredFilePath;
const uploadToSupabase = async (file) => {
    assertSupabaseConfig();
    if (!file.path) {
        throw new Error("Uploaded file path is missing");
    }
    const fileBuffer = node_fs_1.default.readFileSync(file.path);
    const objectKey = file.filename;
    const response = await fetch(buildSupabaseObjectUrl(env_js_1.env.supabaseBucket, objectKey), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env_js_1.env.supabaseKey}`,
            apikey: env_js_1.env.supabaseKey || "",
            "x-upsert": "true",
            "Content-Type": file.mimetype || "application/octet-stream"
        },
        body: fileBuffer
    });
    try {
        node_fs_1.default.unlinkSync(file.path);
    }
    catch {
        // Ignore temp file cleanup errors.
    }
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase upload failed: ${text || response.statusText}`);
    }
    return {
        fileName: file.filename,
        originalName: file.originalname,
        fileUrl: `${SUPABASE_PREFIX}${env_js_1.env.supabaseBucket}/${objectKey}`,
        size: file.size
    };
};
const uploadFileToStorage = async (file) => {
    if (isSupabaseStorage()) {
        return uploadToSupabase(file);
    }
    return {
        fileName: file.filename,
        originalName: file.originalname,
        fileUrl: (0, exports.getPublicFileUrl)(file.filename),
        size: file.size
    };
};
exports.uploadFileToStorage = uploadFileToStorage;
const downloadStoredFile = async (fileName, fileUrl) => {
    const supabaseRef = parseSupabaseRef(fileUrl);
    if (supabaseRef) {
        assertSupabaseConfig();
        const response = await fetch(buildSupabaseObjectUrl(supabaseRef.bucket, supabaseRef.objectKey), {
            headers: {
                Authorization: `Bearer ${env_js_1.env.supabaseKey}`,
                apikey: env_js_1.env.supabaseKey || ""
            }
        });
        if (!response.ok) {
            return null;
        }
        return {
            buffer: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get("content-type") || undefined
        };
    }
    const localPath = (0, exports.resolveStoredFilePath)(fileName) || (0, exports.resolveStoredFilePath)(node_path_1.default.basename(fileUrl || ""));
    if (!localPath) {
        return null;
    }
    return {
        buffer: node_fs_1.default.readFileSync(localPath),
        contentType: undefined
    };
};
exports.downloadStoredFile = downloadStoredFile;
const deleteStoredFile = async (fileName, fileUrl) => {
    const supabaseRef = parseSupabaseRef(fileUrl);
    if (supabaseRef) {
        assertSupabaseConfig();
        await fetch(buildSupabaseObjectUrl(supabaseRef.bucket, supabaseRef.objectKey), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${env_js_1.env.supabaseKey}`,
                apikey: env_js_1.env.supabaseKey || ""
            }
        });
        return;
    }
    const localPath = (0, exports.resolveStoredFilePath)(fileName) || (0, exports.resolveStoredFilePath)(node_path_1.default.basename(fileUrl || ""));
    if (localPath && node_fs_1.default.existsSync(localPath)) {
        try {
            node_fs_1.default.unlinkSync(localPath);
        }
        catch {
            // Ignore local cleanup failures.
        }
    }
};
exports.deleteStoredFile = deleteStoredFile;
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadAbsolutePath);
    },
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const unique = `${Date.now()}-${node_crypto_1.default.randomBytes(5).toString("hex")}`;
        cb(null, `${unique}-${safeName}`);
    }
});
const fileFilter = (_req, file, cb) => {
    const extension = node_path_1.default.extname(file.originalname).toLowerCase();
    if (extension !== ".stl" && extension !== ".obj") {
        cb(new Error("Only STL and OBJ files are allowed"));
        return;
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: env_js_1.env.maxUploadMb * 1024 * 1024
    }
});
const getPublicFileUrl = (fileName) => {
    return `/uploads/${fileName}`;
};
exports.getPublicFileUrl = getPublicFileUrl;
