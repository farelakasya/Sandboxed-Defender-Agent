import { Activity, Flame, ShieldCheck, Swords, Ban } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { QueueHealthResult } from "@/lib/dashboard.utils";
import { QueueHealthCard } from "./QueueHealthCard";

/**
 * Five numeric KPIs + Queue Health. All numeric values come from ONE source —
 * the DB-wide distributions aggregate (passed in via `stats`) — so they stay
 * consistent with the Risk Breakdown donut. Intentionally NO "Developer
 * Notifications" KPI (dev notification is automatic for every ticket).
 */
export interface DashboardKpiStats {
  detectionVolume: number;
  highRiskTickets: number;
  autoContained: number;
  defenderActions: number;
  blockedActions: number;
}

const ICONS: Record<string, LucideIcon> = {
  detection: Activity,
  highRisk: Flame,
  contained: ShieldCheck,
  actions: Swords,
  blocked: Ban,
};

export function DashboardKPICards({
  stats,
  queueHealth,
}: {
  stats: DashboardKpiStats;
  queueHealth: QueueHealthResult;
}) {
  const cards = [
    {
      label: "Detection Volume",
      value: stats.detectionVolume,
      subtext: "Total defender verdicts",
      icon: ICONS.detection,
      tone: "text-orange-400",
    },
    {
      label: "High-Risk Tickets",
      value: stats.highRiskTickets,
      subtext: "Critical + high severity",
      icon: ICONS.highRisk,
      tone: "text-red-400",
    },
    {
      label: "Auto-Contained",
      value: stats.autoContained,
      subtext: "Contained automatically",
      icon: ICONS.contained,
      tone: "text-cyan-400",
    },
    {
      label: "Defender Actions",
      value: stats.defenderActions,
      subtext: "block_ip + flag_user + rate_limit_ip",
      icon: ICONS.actions,
      tone: "text-amber-400",
    },
    {
      label: "Blocked Actions",
      value: stats.blockedActions,
      subtext: "block_ip defender actions",
      icon: ICONS.blocked,
      tone: "text-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, subtext, icon: Icon, tone }) => (
        <Card key={label} className="flex h-[150px] flex-col justify-between p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Icon className={cn("size-4", tone)} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {subtext}
            </p>
          </div>
        </Card>
      ))}

      {/* Queue Health as the sixth KPI — qualitative, with explanation popover. */}
      <QueueHealthCard health={queueHealth} />
    </div>
  );
}
