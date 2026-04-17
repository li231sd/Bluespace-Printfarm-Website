"use client";

import { useEffect, useState } from "react";
import { AdminQueue } from "@/components/admin/admin-queue";
import { GlassCard } from "@/components/shared/glass-card";
import { api } from "@/lib/api";
import { Job } from "@/lib/types";

type Participant = {
  id: string;
  name: string | null;
  email: string;
  credits: number;
  _count: { jobs: number };
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [creditInputs, setCreditInputs] = useState<Record<string, number>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.allJobs(), api.participants()])
      .then(([allJobs, users]) => {
        setJobs(allJobs);
        setParticipants(users);
        setCreditInputs(
          users.reduce<Record<string, number>>((acc, user) => {
            acc[user.id] = user.credits;
            return acc;
          }, {}),
        );
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const saveCredits = async (userId: string) => {
    const participant = participants.find((user) => user.id === userId);
    const nextValue = creditInputs[userId];

    if (!participant || !Number.isFinite(nextValue)) {
      return;
    }

    const targetCredits = Math.max(0, Math.floor(nextValue));
    const delta = targetCredits - participant.credits;
    if (delta === 0) {
      return;
    }

    setSavingUserId(userId);
    setError(null);
    try {
      await api.adjustCredits({
        userId,
        amount: delta,
        reason: "ADMIN_SET_CREDITS",
      });
      const refreshed = await api.participants();
      setParticipants(refreshed);
      setCreditInputs(
        refreshed.reduce<Record<string, number>>((acc, user) => {
          acc[user.id] = user.credits;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingUserId(null);
    }
  };

  const removeUser = async (user: Participant) => {
    const displayName = user.name || user.email;
    const confirmed = window.confirm(
      `Delete user \"${displayName}\" and all their requests? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    setError(null);
    try {
      await api.deleteUser(user.id);
      const [allJobs, users] = await Promise.all([
        api.allJobs(),
        api.participants(),
      ]);
      setJobs(allJobs);
      setParticipants(users);
      setCreditInputs(
        users.reduce<Record<string, number>>((acc, participant) => {
          acc[participant.id] = participant.credits;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingUserId(null);
    }
  };

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-cream">Print manager queue</h1>
      {loading ? (
        <p className="text-sm text-cream/70">Loading queue...</p>
      ) : null}
      <AdminQueue initialJobs={jobs} />

      <GlassCard className="space-y-4">
        <h2 className="text-xl font-bold text-cream">Participants</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-cream/70">No participants found yet.</p>
        ) : (
          <div className="space-y-3">
            {participants.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-mid/35 bg-space-800/65 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-cream">
                    {user.name || user.email}
                  </p>
                  <p className="text-sm text-cream/60">
                    {user.email} • {user._count.jobs} jobs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={creditInputs[user.id] ?? user.credits}
                    aria-label={`Credits for ${user.name || user.email}`}
                    title={`Credits for ${user.name || user.email}`}
                    onChange={(e) =>
                      setCreditInputs((prev) => ({
                        ...prev,
                        [user.id]: Number(e.target.value),
                      }))
                    }
                    className="w-28 rounded-xl border border-blue-mid/40 bg-space-900/70 px-3 py-2 text-sm text-cream"
                  />
                  <button
                    onClick={() => void saveCredits(user.id)}
                    disabled={
                      savingUserId === user.id || deletingUserId === user.id
                    }
                    className="rounded-full bg-blue-mid px-4 py-2 text-xs font-semibold text-cream transition hover:shadow-glow-blue disabled:opacity-60"
                  >
                    {savingUserId === user.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => void removeUser(user)}
                    disabled={
                      deletingUserId === user.id || savingUserId === user.id
                    }
                    className="rounded-full border border-blue-mid/40 bg-space-900/70 px-4 py-2 text-xs font-semibold text-cream transition hover:border-blue-light/60 hover:bg-space-800 disabled:opacity-60"
                  >
                    {deletingUserId === user.id ? "Deleting..." : "Delete User"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
