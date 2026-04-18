"use client";

import { Job } from "@/lib/types";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/shared/glass-card";
import { StatusPill } from "@/components/shared/status-pill";

const toPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PRINT_MINUTES_PER_GRAM = toPositiveNumber(
  process.env.NEXT_PUBLIC_PRINT_MINUTES_PER_GRAM,
  8,
);

const formatEta = (etaMinutes?: number | null) => {
  if (!etaMinutes && etaMinutes !== 0) {
    return null;
  }

  if (etaMinutes < 60) {
    return `${etaMinutes} min`;
  }

  const hours = Math.floor(etaMinutes / 60);
  const minutes = etaMinutes % 60;
  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
};

const getPrintingProgress = (job: Job) => {
  if (job.status !== "PRINTING") {
    return null;
  }

  const printingStart = job.timeline
    ?.filter((event) => event.status === "PRINTING")
    .map((event) => new Date(event.createdAt).getTime())
    .sort((a, b) => b - a)[0];

  if (!printingStart) {
    return null;
  }

  const estimatedMinutes = Math.max(
    20,
    Math.round(job.filamentGrams * PRINT_MINUTES_PER_GRAM),
  );
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - printingStart) / 60000),
  );
  const rawProgress = Math.round((elapsedMinutes / estimatedMinutes) * 100);
  const percent = Math.max(1, Math.min(99, rawProgress));

  return {
    percent,
    elapsedMinutes,
    estimatedMinutes,
  };
};

const formatMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};

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
      {jobs.map((job) => {
        const printingProgress = getPrintingProgress(job);

        return (
          <GlassCard key={job.id} className="animate-rise">
            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-ink">{job.title}</h3>
                <p className="mt-1 text-sm text-ink/70">
                  {job.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-ink/60">
                  <span>{job.filamentGrams}g</span>
                  <span>{job.creditCost} credits</span>
                  {job.queuePosition ? (
                    <span>Queue #{job.queuePosition}</span>
                  ) : null}
                  {job.etaMinutes !== null && job.etaMinutes !== undefined ? (
                    <span>ETA {formatEta(job.etaMinutes)}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onDownload(job.id, job.fileName)}
                    className="rounded-lg border border-blue-light/45 bg-blue-mid/20 px-3 py-2 text-xs font-semibold text-cream transition hover:shadow-glow-light"
                  >
                    Download model
                  </button>
                </div>
                {printingProgress ? (
                  <div className="mt-4 rounded-xl border border-blue-light/30 bg-space-900/45 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-cream/75">
                      <span className="font-semibold uppercase tracking-wide">
                        Print Progress
                      </span>
                      <span>{printingProgress.percent}%</span>
                    </div>
                    <progress
                      value={printingProgress.percent}
                      max={100}
                      className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-blue-mid/25 [&::-webkit-progress-value]:bg-blue-light [&::-moz-progress-bar]:bg-blue-light"
                      aria-label={`Print progress ${printingProgress.percent}%`}
                    />
                    <p className="mt-2 text-[11px] text-cream/60">
                      {formatMinutes(printingProgress.elapsedMinutes)} elapsed
                      of ~{formatMinutes(printingProgress.estimatedMinutes)}{" "}
                      estimated
                    </p>
                  </div>
                ) : null}
                {job.needsAttentionFlags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.needsAttentionFlags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200"
                      >
                        Needs Attention: {flag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {job.timeline?.length ? (
                  <div className="mt-4 rounded-2xl border border-blue-mid/20 bg-space-900/35 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-cream/70">
                      Timeline
                    </p>
                    <ul className="mt-2 space-y-2">
                      {job.timeline.map((event) => (
                        <li key={event.id} className="text-xs text-cream/80">
                          <span className="font-semibold text-cream">
                            {event.label}
                          </span>{" "}
                          <span className="text-cream/60">
                            {new Date(event.createdAt).toLocaleString()}
                          </span>
                          {event.notes ? (
                            <span className="text-cream/70">
                              {" "}
                              • {event.notes}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <StatusPill status={job.status} />
                </div>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
