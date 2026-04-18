"use client";

import { JobTimelineEvent } from "@/lib/types";

export function Timeline({ events }: { events: JobTimelineEvent[] }) {
  if (!events.length) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-blue-mid/20 bg-space-900/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-cream/70 mb-4">
        Timeline
      </p>
      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id} className="relative pl-6">
            {/* Vertical line */}
            {index < events.length - 1 && (
              <div className="absolute left-2 top-5 h-6 w-px bg-gradient-to-b from-blue-mid/50 to-blue-mid/10" />
            )}

            {/* Circle dot */}
            <div className="absolute left-0.5 top-1 h-4 w-4 rounded-full border border-blue-mid/70 bg-blue-mid/20" />

            {/* Event content */}
            <div className="pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-cream text-sm">
                  {event.label}
                </span>
                <span className="text-xs text-cream/50 flex-shrink-0">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              {event.notes ? (
                <p className="text-xs text-cream/60 mt-1">{event.notes}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
