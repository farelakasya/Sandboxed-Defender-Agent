import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { QueueHealth } from "@/lib/dashboard.utils";

const STYLES: Record<QueueHealth, string> = {
  Stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Busy: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Overloaded: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function QueueHealthBadge({
  health,
  className,
}: {
  health: QueueHealth;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        STYLES[health],
        className
      )}
    >
      <Activity className="size-3.5" />
      {health}
    </span>
  );
}
