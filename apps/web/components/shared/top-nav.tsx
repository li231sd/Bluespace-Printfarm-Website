"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { authStore } from "@/lib/auth";
import { SessionUser } from "@/lib/types";

export function TopNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // Read initial state
    setUser(authStore.getUser());

    // Listen to storage changes (login/logout in other tab or this tab)
    const handleStorageChange = () => {
      setUser(authStore.getUser());
    };

    window.addEventListener("storage", handleStorageChange);

    // Custom event for same-tab updates
    window.addEventListener("auth-change", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleStorageChange);
    };
  }, []);

  const userLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/jobs", label: "My Jobs" },
    { href: "/dashboard/submit", label: "Submit" },
  ];

  const adminLinks = [{ href: "/admin/jobs", label: "Queue" }];
  const visibleLinks = user?.role === "ADMIN" ? adminLinks : userLinks;

  const isActiveLink = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-blue-mid/30 bg-space-800/70 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link
          href="/"
          className="group relative rounded-full border border-blue-mid/35 px-4 py-2 text-lg font-bold text-cream transition hover:shadow-glow-light"
        >
          Bluespace
        </Link>
        <div className="flex items-center gap-2">
          {visibleLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "relative rounded-full px-4 py-2 text-sm font-medium transition",
                isActiveLink(item.href)
                  ? "bg-blue-mid text-cream shadow-glow-blue"
                  : "text-cream/80 hover:bg-space-700 hover:text-cream",
              )}
            >
              {item.label}
              <span
                className={clsx(
                  "absolute bottom-1 left-3 h-[2px] bg-blue-light transition-all duration-300",
                  isActiveLink(item.href) ? "w-[calc(100%-1.5rem)]" : "w-0",
                )}
              />
            </Link>
          ))}
          {!user ? (
            <Link
              href="/auth"
              className="rounded-full bg-blue-mid px-4 py-2 text-sm font-semibold text-cream transition hover:shadow-glow-blue"
            >
              Login
            </Link>
          ) : (
            <button
              onClick={() => {
                authStore.clear();
                window.dispatchEvent(new Event("auth-change"));
                window.location.href = "/auth";
              }}
              className="rounded-full border border-blue-light/40 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-space-700 hover:shadow-glow-light"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
