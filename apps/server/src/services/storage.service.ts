import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";
import { scanFileForVirus, isScanResultClean } from "./virus-scan.service.js";

const SUPABASE_PREFIX = "supabase://";

export const resolveUploadDir = () => {
	const fromCurrent = path.resolve(process.cwd(), env.uploadDir);
	const fromServerPackage = path.resolve(process.cwd(), "../../", env.uploadDir);

	if (fs.existsSync(fromCurrent)) {
		return fromCurrent;
	}

	return fromServerPackage;
};

const uploadAbsolutePath = resolveUploadDir();
fs.mkdirSync(uploadAbsolutePath, { recursive: true });

const isSupabaseStorage = () => env.storageMode === "supabase";

const hasSupabaseConfig = () => Boolean(env.supabaseUrl && env.supabaseKey && env.supabaseBucket);

const assertSupabaseConfig = () => {
	const missing: string[] = [];
	if (!env.supabaseUrl) {
		missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
	}
	if (!env.supabaseKey) {
		missing.push("SUPABASE_KEY");
	}
	if (!env.supabaseBucket) {
		missing.push("SUPABASE_BUCKET");
	}

	if (missing.length === 0 && env.supabaseUrl?.includes("<your-project-ref>")) {
		missing.push("SUPABASE_URL (replace <your-project-ref> with real project ref)");
	}

	if (missing.length === 0) {
		try {
			new URL(env.supabaseUrl || "");
		} catch {
			missing.push("SUPABASE_URL (must be a valid https URL)");
		}
	}

	if (missing.length === 0 && hasSupabaseConfig()) {
		return;
	}

	throw new Error(`Supabase storage is not fully configured. Missing: ${missing.join(", ")}`);
};

const buildSupabaseObjectUrl = (bucket: string, objectKey: string) => {
	const base = (env.supabaseUrl || "").replace(/\/$/, "");
	return `${base}/storage/v1/object/${bucket}/${encodeURIComponent(objectKey)}`;
};

const parseSupabaseRef = (fileUrl: string) => {
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

export const resolveStoredFilePath = (fileName: string) => {
	const safeFileName = path.basename(fileName);
	if (!safeFileName) {
		return null;
	}

	const candidates = [
		safeFileName,
		safeFileName.replace(/_{3,}/g, "__"),
		safeFileName.replace(/_{2,}/g, "_")
	];

	for (const candidate of [...new Set(candidates)]) {
		const absolute = path.join(uploadAbsolutePath, candidate);
		if (fs.existsSync(absolute)) {
			return absolute;
		}
	}

	return null;
};

const uploadToSupabase = async (file: Express.Multer.File) => {
	assertSupabaseConfig();

	if (!file.path) {
		throw new Error("Uploaded file path is missing");
	}

	const fileBuffer = fs.readFileSync(file.path);
	const objectKey = file.filename;
	const response = await fetch(buildSupabaseObjectUrl(env.supabaseBucket, objectKey), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.supabaseKey}`,
			apikey: env.supabaseKey || "",
			"x-upsert": "true",
			"Content-Type": file.mimetype || "application/octet-stream"
		},
		body: fileBuffer
	});

	try {
		fs.unlinkSync(file.path);
	} catch {
		// Ignore temp file cleanup errors.
	}

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Supabase upload failed: ${text || response.statusText}`);
	}

	return {
		fileName: file.filename,
		originalName: file.originalname,
		fileUrl: `${SUPABASE_PREFIX}${env.supabaseBucket}/${objectKey}`,
		size: file.size
	};
};

export const uploadFileToStorage = async (file: Express.Multer.File) => {
	// Scan file for viruses before storing
	if (file.path) {
		const scanResult = await scanFileForVirus(file.path);
		if (!isScanResultClean(scanResult)) {
			// Delete the infected file
			try {
				fs.unlinkSync(file.path);
			} catch {
				// Ignore cleanup errors
			}
			throw new Error(
				`File failed security scan: ${scanResult?.threats.join(", ") || "Malware detected"}`
			);
		}
	}

	if (isSupabaseStorage()) {
		return uploadToSupabase(file);
	}

	return {
		fileName: file.filename,
		originalName: file.originalname,
		fileUrl: getPublicFileUrl(file.filename),
		size: file.size
	};
};

export const downloadStoredFile = async (fileName: string, fileUrl: string) => {
	const supabaseRef = parseSupabaseRef(fileUrl);
	if (supabaseRef) {
		assertSupabaseConfig();

		const response = await fetch(buildSupabaseObjectUrl(supabaseRef.bucket, supabaseRef.objectKey), {
			headers: {
				Authorization: `Bearer ${env.supabaseKey}`,
				apikey: env.supabaseKey || ""
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

	const localPath = resolveStoredFilePath(fileName) || resolveStoredFilePath(path.basename(fileUrl || ""));
	if (!localPath) {
		return null;
	}

	return {
		buffer: fs.readFileSync(localPath),
		contentType: undefined
	};
};

export const deleteStoredFile = async (fileName: string, fileUrl: string) => {
	const supabaseRef = parseSupabaseRef(fileUrl);
	if (supabaseRef) {
		assertSupabaseConfig();

		await fetch(buildSupabaseObjectUrl(supabaseRef.bucket, supabaseRef.objectKey), {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${env.supabaseKey}`,
				apikey: env.supabaseKey || ""
			}
		});
		return;
	}

	const localPath = resolveStoredFilePath(fileName) || resolveStoredFilePath(path.basename(fileUrl || ""));
	if (localPath && fs.existsSync(localPath)) {
		try {
			fs.unlinkSync(localPath);
		} catch {
			// Ignore local cleanup failures.
		}
	}
};

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadAbsolutePath);
	},
	filename: (_req, file, cb) => {
		const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
		const unique = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
		cb(null, `${unique}-${safeName}`);
	}
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
	const extension = path.extname(file.originalname).toLowerCase();
	if (extension !== ".stl" && extension !== ".obj") {
		cb(new Error("Only STL and OBJ files are allowed"));
		return;
	}
	cb(null, true);
};

export const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: env.maxUploadMb * 1024 * 1024
	}
});

export const getPublicFileUrl = (fileName: string) => {
	return `/uploads/${fileName}`;
};
