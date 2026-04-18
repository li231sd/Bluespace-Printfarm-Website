"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { GlassCard } from "@/components/shared/glass-card";

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

export default function SubmitJob() {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
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

  const canSubmit = !!user && !!file;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please upload STL or OBJ file.");
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
