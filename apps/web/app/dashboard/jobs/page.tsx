"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Job } from "@/lib/types";
import { JobList } from "@/components/dashboard/job-list";

export default function UserJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myJobs()
      .then(setJobs)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-ink/70">Loading your jobs...</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error}</p>
        <Link href="/auth" className="btn-secondary inline-flex">
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-deep">My print jobs</h1>
      <JobList jobs={jobs} />
    </div>
  );
}
