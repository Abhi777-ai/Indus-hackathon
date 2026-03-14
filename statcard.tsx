import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ElementType;
  accentClass?: string;
}

export function StatCard({ label, value, trend, icon: Icon, accentClass }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={cn("rounded-md p-1.5", accentClass ?? "bg-muted")}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <h3 className="text-2xl font-semibold tracking-tight tabular-nums">{value}</h3>
        {trend !== undefined && (
          <span
            className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-600" : "text-muted-foreground"
            )}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "—"} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}
