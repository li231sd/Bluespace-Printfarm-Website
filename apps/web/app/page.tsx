"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = authStore.getUser();
    if (user) {
      router.push(user.role === "ADMIN" ? "/admin/jobs" : "/dashboard");
    } else {
      router.push("/auth");
    }
  }, [router]);

  return null;
}
