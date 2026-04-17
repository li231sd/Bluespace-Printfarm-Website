"use client";

import { Job } from "@/lib/types";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/shared/glass-card";
import { StatusPill } from "@/components/shared/status-pill";

export function JobList({ jobs }: { jobs: Job[] }) {
  const onDownload = async (jobId: string, fileName: string) => {
    try {
      await api.downloadJobFile(jobId, fileName);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  if (!jobs.length) {
    return (
      <GlassCard className="text-center text-ink/70">
        No jobs yet. Submit your first model.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <GlassCard key={job.id} className="animate-rise">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-ink">{job.title}</h3>
              <p className="mt-1 text-sm text-ink/70">
                {job.description || "No description"}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-ink/60">
                <span>{job.filamentGrams}g</span>
                <span>{job.creditCost} credits</span>
                <button
                  type="button"
                  onClick={() => void onDownload(job.id, job.fileName)}
                  className="rounded-lg border border-blue-light/45 bg-blue-mid/20 px-3 py-2 text-xs font-semibold text-cream transition hover:shadow-glow-light"
                >
                  {job.fileName}
                </button>
              </div>
            </div>
            <StatusPill status={job.status} />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
