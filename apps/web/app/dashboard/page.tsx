"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Job } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { GlassCard } from "@/components/shared/glass-card";
import { JobList } from "@/components/dashboard/job-list";

export default function DashboardPage() {
  const { user, loading } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (!user) return;
    api
      .myJobs()
      .then(setJobs)
      .catch(() => setJobs([]));
  }, [user]);

  if (loading) {
    return <p className="text-sm text-ink/70">Loading dashboard...</p>;
  }

  if (!user) {
    return (
      <GlassCard>
        <p className="text-ink/70">Please log in first.</p>
        <Link href="/auth" className="btn-primary mt-4 inline-flex">
          Go to login
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard>
          <p className="text-sm text-ink/70">Remaining credits</p>
          <p className="mt-2 text-4xl font-bold text-deep">{user.credits}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-ink/70">Total submissions</p>
          <p className="mt-2 text-4xl font-bold text-deep">{jobs.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-ink/70">Pending jobs</p>
          <p className="mt-2 text-4xl font-bold text-deep">
            {jobs.filter((job) => job.status === "PENDING").length}
          </p>
        </GlassCard>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-deep">Recent jobs</h2>
        <Link href="/dashboard/submit" className="btn-primary">
          Submit new request
        </Link>
      </div>

      <JobList jobs={jobs.slice(0, 4)} />
    </div>
  );
}
