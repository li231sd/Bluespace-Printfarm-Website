import path from "node:path";
import { JobStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { downloadStoredFile } from "./storage.service.js";

const activeStatuses: JobStatus[] = ["PENDING", "APPROVED", "PRINTING"];

const hasAsciiStlGeometry = (text: string) => {
  const normalized = text.toLowerCase();
  return normalized.includes("facet normal") && normalized.includes("vertex");
};

const hasObjGeometry = (text: string) => {
  const lines = text.split(/\r?\n/);
  const hasVertices = lines.some((line) => line.startsWith("v "));
  const hasFaces = lines.some((line) => line.startsWith("f "));
  return hasVertices && hasFaces;
};

const hasBinaryStlGeometry = (buffer: Buffer) => {
  if (buffer.length < 84) {
    return false;
  }

  const triangleCount = buffer.readUInt32LE(80);
  return triangleCount > 0;
};

export const inspectModelFile = async (fileName: string, fileUrl: string) => {
  const flags = new Set<string>();
  const warnings: string[] = [];

  const ext = path.extname(fileName).toLowerCase();
  if (![".stl", ".obj"].includes(ext)) {
    flags.add("BAD_FILE");
    warnings.push("Unsupported file extension. Use STL or OBJ.");
    return { flags: [...flags], warnings };
  }

  const downloaded = await downloadStoredFile(fileName, fileUrl);
  if (!downloaded) {
    flags.add("BAD_FILE");
    warnings.push("Uploaded file cannot be read from storage.");
    return { flags: [...flags], warnings };
  }

  const buffer = downloaded.buffer;
  if (buffer.length < 512) {
    flags.add("BAD_FILE");
    warnings.push("File appears too small to be a valid printable model.");
  }

  if (ext === ".obj") {
    const text = buffer.toString("utf8");
    if (!hasObjGeometry(text)) {
      flags.add("BAD_FILE");
      warnings.push("OBJ sanity check failed: missing vertices or faces.");
    }
  }

  if (ext === ".stl") {
    const textSample = buffer.subarray(0, Math.min(buffer.length, 1024 * 64)).toString("utf8");
    const looksAscii = textSample.trimStart().toLowerCase().startsWith("solid");
    const isValid = looksAscii ? hasAsciiStlGeometry(textSample) : hasBinaryStlGeometry(buffer);
    if (!isValid) {
      flags.add("BAD_FILE");
      warnings.push("STL sanity check failed: mesh facets were not detected.");
    }
  }

  return { flags: [...flags], warnings };
};

export const buildNeedsAttentionFlags = (input: {
  fileFlags: string[];
  hasUnclearSpecs: boolean;
  hasCreditIssue: boolean;
}) => {
  const flags = new Set<string>(input.fileFlags);

  if (input.hasUnclearSpecs) {
    flags.add("UNCLEAR_SPECS");
  }

  if (input.hasCreditIssue) {
    flags.add("CREDIT_ISSUE");
  }

  return [...flags];
};

type QueueJob = { id: string; status: JobStatus; createdAt: Date };

export const enrichJobsWithQueueInfo = <T extends QueueJob>(
  jobs: T[],
  queueSource: QueueJob[] = jobs,
) => {
  const queue = queueSource
    .filter((job) => activeStatuses.includes(job.status))
    .sort((a, b) => {
      const createdAtDelta = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }
      return a.id.localeCompare(b.id);
    });

  const positionByJobId = new Map(queue.map((job, index) => [job.id, index + 1]));

  return jobs.map((job) => {
    const queuePosition = positionByJobId.get(job.id) ?? null;
    const etaMinutes = queuePosition ? (queuePosition - 1) * env.queueEtaMinutesPerActiveJob : null;
    return {
      ...job,
      queuePosition,
      etaMinutes,
    };
  });
};
