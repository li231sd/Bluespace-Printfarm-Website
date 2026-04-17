import { JobStatus } from "@/lib/types";
import clsx from "clsx";

const statusStyles: Record<JobStatus, string> = {
  PENDING: "border border-blue-mid/40 bg-space-700/80 text-blue-light",
  APPROVED: "border border-blue-mid/40 bg-blue-mid/20 text-cream",
  PRINTING: "border border-blue-light/50 bg-blue-light/20 text-cream",
  COMPLETED: "border border-cream/40 bg-cream/15 text-cream",
  REJECTED: "border border-blue-mid/40 bg-space-700 text-blue-light",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
