"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { GlassCard } from "@/components/shared/glass-card";

type PreflightResult = {
  errors: string[];
  warnings: string[];
};

const toPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const AUTO_ESTIMATE_BYTES_PER_GRAM = toPositiveNumber(
  process.env.NEXT_PUBLIC_AUTO_ESTIMATE_BYTES_PER_GRAM,
  20 * 1024,
);
const MINIMUM_FILAMENT_GRAMS = toPositiveNumber(
  process.env.NEXT_PUBLIC_MINIMUM_FILAMENT_GRAMS,
  3,
);
const CREDIT_PER_GRAM = toPositiveNumber(
  process.env.NEXT_PUBLIC_CREDIT_PER_GRAM,
  1,
);

const hasObjGeometry = (text: string) => {
  const lines = text.split(/\r?\n/);
  const hasVertices = lines.some((line) => line.startsWith("v "));
  const hasFaces = lines.some((line) => line.startsWith("f "));
  return hasVertices && hasFaces;
};

const hasAsciiStlGeometry = (text: string) => {
  const normalized = text.toLowerCase();
  return normalized.includes("facet normal") && normalized.includes("vertex");
};

const hasBinaryStlGeometry = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 84) {
    return false;
  }

  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  return triangleCount > 0;
};

const runPreflightChecks = async (file: File): Promise<PreflightResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension || !["stl", "obj"].includes(extension)) {
    errors.push("Unsupported file type. Please use STL or OBJ.");
    return { errors, warnings };
  }

  if (file.size < 512) {
    errors.push("File appears too small to contain printable geometry.");
  }

  if (file.size > 35 * 1024 * 1024) {
    warnings.push(
      "Large model detected. Review and print setup may take longer.",
    );
  }

  if (extension === "obj") {
    const text = await file.text();
    if (!hasObjGeometry(text)) {
      errors.push("OBJ sanity check failed: missing vertex or face records.");
    }
  }

  if (extension === "stl") {
    const buffer = await file.arrayBuffer();
    const textSample = new TextDecoder().decode(
      buffer.slice(0, Math.min(buffer.byteLength, 1024 * 64)),
    );
    const looksAscii = textSample.trimStart().toLowerCase().startsWith("solid");
    const valid = looksAscii
      ? hasAsciiStlGeometry(textSample)
      : hasBinaryStlGeometry(buffer);
    if (!valid) {
      errors.push("STL sanity check failed: mesh facets were not detected.");
    }
  }

  return { errors, warnings };
};

export default function SubmitJob() {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult>({
    errors: [],
    warnings: [],
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const estimatedFilamentGrams = useMemo(() => {
    if (!file) {
      return null;
    }
    const sizeBased = Math.ceil(file.size / AUTO_ESTIMATE_BYTES_PER_GRAM);
    return Math.max(MINIMUM_FILAMENT_GRAMS, sizeBased);
  }, [file]);

  const estimatedCredits = useMemo(() => {
    if (estimatedFilamentGrams === null) {
      return null;
    }
    return Math.ceil(estimatedFilamentGrams * CREDIT_PER_GRAM);
  }, [estimatedFilamentGrams]);

  const canSubmit = !!user && !!file && preflight.errors.length === 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please upload STL or OBJ file.");
      return;
    }

    if (preflight.errors.length > 0) {
      setError("Please fix file issues before submitting.");
      return;
    }

    if (!user) {
      setError("Please login first.");
      return;
    }

    setUploading(true);
    const form = new FormData(e.currentTarget);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const uploaded = await api.upload(uploadData);

      await api.createJob({
        title: String(form.get("title") || ""),
        description: String(form.get("description") || ""),
        fileSize: uploaded.size,
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
      });

      router.push("/dashboard/jobs");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="mb-8 text-3xl font-bold text-deep">Submit 3D model</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassCard className="space-y-6 p-8">
          <div>
            <label className="mb-2 block text-sm text-ink/65">
              Project title
            </label>
            <input
              name="title"
              type="text"
              className="input"
              aria-label="Project title"
              title="Project title"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-ink/65">
              Description
            </label>
            <textarea
              name="description"
              className="input min-h-24 resize-y"
              placeholder="What does this part do?"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-ink/65">
              Upload STL/OBJ
            </label>
            <input
              type="file"
              accept=".stl,.obj"
              required
              aria-label="Upload STL or OBJ file"
              title="Upload STL or OBJ file"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
                if (!nextFile) {
                  setPreflight({ errors: [], warnings: [] });
                  return;
                }

                void runPreflightChecks(nextFile).then(setPreflight);
              }}
              className="input cursor-pointer"
            />
            <p className="mt-1 text-xs text-ink/55">
              Only STL/OBJ files up to 50MB.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-light/35 bg-space-800/55 p-4 text-sm text-cream/80">
            <p>
              Filament grams and credit cost are calculated automatically from
              the uploaded model file.
            </p>
            {estimatedFilamentGrams !== null && estimatedCredits !== null ? (
              <p className="mt-2 font-semibold text-cream">
                Estimated usage: {estimatedFilamentGrams} g ({estimatedCredits}{" "}
                credits)
              </p>
            ) : (
              <p className="mt-2 text-cream/65">
                Select a file to preview the estimate.
              </p>
            )}
            {preflight.errors.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-rose-300">
                {preflight.errors.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
            {preflight.warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-300">
                {preflight.warnings.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={uploading || !canSubmit}
            className="btn-primary w-full disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Submit for approval"}
          </button>
        </GlassCard>
      </form>
    </div>
  );
}
