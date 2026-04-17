import { ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-blue-mid/30 bg-space-800/60 p-6 shadow-soft backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:shadow-glow-blue",
        className,
      )}
    >
      {children}
    </div>
  );
}
