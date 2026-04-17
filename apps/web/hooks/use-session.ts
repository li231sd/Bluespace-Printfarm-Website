"use client";

import { useEffect, useMemo, useState } from "react";
import { authStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { SessionUser } from "@/lib/types";

export const useSession = () => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = authStore.getUser();
    if (!current) {
      setLoading(false);
      return;
    }

    setUser(current);
    api.me()
      .then((freshUser) => {
        authStore.setSession({ token: authStore.getToken() ?? "", user: freshUser });
        setUser(freshUser);
      })
      .catch(() => {
        authStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return useMemo(
    () => ({
      user,
      loading,
      logout: () => {
        authStore.clear();
        setUser(null);
      },
      setUser
    }),
    [loading, user]
  );
};
