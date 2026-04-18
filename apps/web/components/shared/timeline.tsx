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
          <div key={event.id} className="relative pl-8">
            {/* Vertical line */}
            {index < events.length - 1 && (
              <div className="absolute left-3 top-8 h-8 w-0.5 bg-gradient-to-b from-blue-mid/60 to-blue-mid/20" />
            )}

            {/* Circle dot */}
            <div className="absolute left-0 top-1.5 h-7 w-7 rounded-full border-2 border-blue-mid bg-space-900/80 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-blue-mid/80" />
            </div>

            {/* Event content */}
            <div className="pb-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-cream text-sm">
                  {event.label}
                </span>
                <span className="text-xs text-cream/50 ml-2">
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
