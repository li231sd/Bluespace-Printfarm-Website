"use client";

import { useEffect, useMemo, useState } from "react";
import { Job, JobStatus } from "@/lib/types";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/shared/glass-card";
import { StatusPill } from "@/components/shared/status-pill";

const statuses: JobStatus[] = ["APPROVED", "REJECTED", "COMPLETED"];

const queueStatusPriority: Record<JobStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  PRINTING: 2,
  COMPLETED: 3,
  REJECTED: 4,
};

const sortJobsForQueue = (items: Job[]) =>
  [...items].sort((a, b) => {
    const statusDelta =
      queueStatusPriority[a.status] - queueStatusPriority[b.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const createdAtDelta =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return a.id.localeCompare(b.id);
  });

const statusLabel: Record<JobStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PRINTING: "Printing",
  COMPLETED: "Completed",
  REJECTED: "Denied",
};

export function AdminQueue({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const orderedJobs = useMemo(() => sortJobsForQueue(jobs), [jobs]);

  const refreshJobs = async () => {
    if (busyId) {
      return;
    }

    try {
      setJobs(await api.allJobs());
    } catch {
      // Keep the current queue visible if a periodic refresh fails.
    }
  };

  const onDownload = async (jobId: string, fileName: string) => {
    try {
      await api.downloadJobFile(jobId, fileName);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 10000);

    const onFocus = () => {
      void refreshJobs();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshJobs();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [busyId]);

  const mutate = async (jobId: string, task: () => Promise<unknown>) => {
    setBusyId(jobId);
    try {
      await task();
      setJobs(await api.allJobs());
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-4">
      {orderedJobs.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-ink/70">
            No print requests in the queue yet.
          </p>
        </GlassCard>
      ) : null}
      {orderedJobs.map((job) => (
        <GlassCard key={job.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-cream">{job.title}</h3>
              <p className="text-sm text-cream/70">
                {job.user?.name || job.user?.email} • {job.filamentGrams}g •{" "}
                {job.creditCost} credits
              </p>
            </div>
            <StatusPill status={job.status} />
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() =>
                  mutate(job.id, () => api.updateStatus(job.id, status))
                }
                disabled={busyId === job.id}
                className="rounded-full border border-blue-mid/35 bg-space-800/65 px-3 py-2 text-xs font-medium text-cream/85 transition hover:border-blue-light/60 hover:bg-space-700 disabled:opacity-60"
              >
                {statusLabel[status]}
              </button>
            ))}
            <button
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete request \"${job.title}\"? This cannot be undone.`,
                  )
                ) {
                  return;
                }
                void mutate(job.id, () => api.deleteJob(job.id));
              }}
              disabled={busyId === job.id}
              className="rounded-full border border-blue-mid/40 bg-space-900/70 px-3 py-2 text-xs font-medium text-cream/90 transition hover:border-blue-light/60 hover:bg-space-800 disabled:opacity-60"
            >
              Delete Request
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input
              type="number"
              min={1}
              defaultValue={job.filamentGrams}
              aria-label={`Estimated grams for ${job.title}`}
              title={`Estimated grams for ${job.title}`}
              className="w-28 rounded-xl border border-blue-mid/40 bg-space-900/70 px-3 py-2 text-cream"
              onBlur={(e) => {
                const grams = Number(e.target.value);
                if (grams > 0 && grams !== job.filamentGrams) {
                  void mutate(job.id, () => api.adjustEstimate(job.id, grams));
                }
              }}
            />
            <span className="text-cream/70">Adjust estimate (grams)</span>
            <button
              type="button"
              onClick={() => void onDownload(job.id, job.fileName)}
              className="rounded-lg border border-blue-light/45 bg-blue-mid/20 px-3 py-2 text-xs font-semibold text-cream transition hover:shadow-glow-light"
            >
              {job.fileName}
            </button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
