"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { triggerAuthChange } from "@/lib/auth-events";
import { GlassCard } from "@/components/shared/glass-card";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };

    try {
      const session =
        mode === "signup"
          ? await api.signup(payload)
          : await api.login({
              email: payload.email,
              password: payload.password,
            });
      authStore.setSession(session);
      triggerAuthChange();
      router.push(session.user.role === "ADMIN" ? "/admin/jobs" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <p className="inline-flex rounded-full border border-blue-mid/35 bg-space-700/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream/80">
          Access portal
        </p>
        <h1 className="text-4xl font-bold text-deep">Welcome to Bluespace</h1>
        <p className="text-ink/70">
          Log in as a participant or sign up with your hackathon email. Credits
          start at 1000 and are only deducted when your request is approved.
        </p>
      </div>

      <GlassCard>
        <div className="mb-6 flex gap-2 rounded-full border border-blue-mid/35 bg-space-700/80 p-1">
          {(["login", "signup"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === item
                  ? "bg-blue-mid text-cream shadow-glow-light"
                  : "text-cream/70 hover:bg-space-800/70 hover:text-cream"
              }`}
            >
              {item === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <input
              name="name"
              className="input"
              placeholder="Team name"
              required
            />
          ) : null}
          <input
            type="email"
            name="email"
            className="input"
            placeholder="Email"
            required
          />
          <input
            type="password"
            name="password"
            className="input"
            placeholder="Password"
            minLength={8}
            required
          />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            disabled={loading}
            className="btn-primary w-full"
            type="submit"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
