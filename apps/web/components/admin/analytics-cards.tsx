import { GlassCard } from "@/components/shared/glass-card";

export function AnalyticsCards({
  totalFilamentUsed,
  activeJobs,
  totalJobs,
}: {
  totalFilamentUsed: number;
  activeJobs: number;
  totalJobs: number;
}) {
  const cards = [
    { label: "Total filament used", value: `${totalFilamentUsed} g` },
    { label: "Active jobs", value: activeJobs },
    { label: "Total jobs", value: totalJobs },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <GlassCard key={card.label}>
          <p className="text-sm text-ink/70">{card.label}</p>
          <p className="mt-2 text-3xl font-bold text-deep">{card.value}</p>
        </GlassCard>
      ))}
    </div>
  );
}
