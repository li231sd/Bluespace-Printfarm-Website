import { authStore } from "@/lib/auth";

export const triggerAuthChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-change"));
  }
};
