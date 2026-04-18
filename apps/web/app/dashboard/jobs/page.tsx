"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppNotification, Job } from "@/lib/types";
import { JobList } from "@/components/dashboard/job-list";

export default function UserJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.myJobs(), api.notifications()])
      .then(([myJobs, myNotifications]) => {
        setJobs(myJobs);
        setNotifications(myNotifications);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const unreadNotifications = notifications.filter((item) => !item.readAt);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  };

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
      <section className="rounded-2xl border border-blue-mid/30 bg-space-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream/80">
            Notifications
          </h2>
          <span className="text-xs text-cream/60">
            {unreadNotifications.length} unread
          </span>
        </div>
        {!notifications.length ? (
          <p className="text-sm text-cream/65">No notifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 8).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-blue-mid/20 bg-space-800/55 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-cream">
                    {item.title}
                  </p>
                  <p className="text-xs text-cream/70">{item.message}</p>
                </div>
                {!item.readAt ? (
                  <button
                    onClick={() => void markRead(item.id)}
                    className="rounded-full border border-blue-light/45 px-3 py-1 text-[11px] font-semibold text-cream"
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="text-[11px] text-cream/50">Read</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <JobList jobs={jobs} />
    </div>
  );
}
