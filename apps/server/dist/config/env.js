"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: "../../.env" });
dotenv_1.default.config();
const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};
exports.env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: toNumber(process.env.API_PORT, 4000),
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret",
    adminEmail: process.env.ADMIN_EMAIL ?? "manager@hackathon.dev",
    adminName: process.env.ADMIN_NAME ?? "3D Print Manager",
    creditPerGram: toNumber(process.env.CREDIT_PER_GRAM, 1),
    autoEstimateBytesPerGram: toNumber(process.env.AUTO_ESTIMATE_BYTES_PER_GRAM, 20 * 1024),
    minimumFilamentGrams: toNumber(process.env.MINIMUM_FILAMENT_GRAMS, 3),
    maxUploadMb: toNumber(process.env.MAX_UPLOAD_MB, 50),
    storageMode: process.env.STORAGE_MODE ?? "local",
    uploadDir: process.env.UPLOAD_DIR ?? "storage/uploads",
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    supabaseBucket: process.env.SUPABASE_BUCKET ?? "uploads",
    awsRegion: process.env.AWS_REGION ?? "us-east-1",
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsBucket: process.env.AWS_S3_BUCKET,
    awsEndpoint: process.env.AWS_S3_ENDPOINT
};
