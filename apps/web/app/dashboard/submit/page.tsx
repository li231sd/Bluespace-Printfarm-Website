"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { GlassCard } from "@/components/shared/glass-card";

export default function SubmitJob() {
  const { user } = useSession();
  const [grams, setGrams] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const estimatedCredits = useMemo(() => grams, [grams]);
  const canSubmit = !!user && grams > 0 && !!file;

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

    if (user.credits < estimatedCredits) {
      setError("Estimated cost exceeds available credits.");
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
        filamentGrams: grams,
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm text-ink/65">
                Estimated filament (grams)
              </label>
              <input
                type="number"
                min={1}
                value={grams || ""}
                aria-label="Estimated filament grams"
                title="Estimated filament grams"
                onChange={(e) => setGrams(parseInt(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-ink/65">
                Estimated cost
              </label>
              <div className="rounded-2xl border border-blue-light/45 bg-blue-mid/20 p-3 font-bold text-cream">
                {estimatedCredits} credits
              </div>
            </div>
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
