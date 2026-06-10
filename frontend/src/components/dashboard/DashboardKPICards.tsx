import { AlertTriangle, Flame, ShieldCheck, Eye, Ban, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardMetrics } from "@/lib/dashboard.utils";
import { QueueHealthBadge } from "./QueueHealthBadge";

/**
 * Six product-focused KPIs. Intentionally NO "Developer Notifications" KPI —
 * dev notification is assumed to happen automatically for every ticket.
 */
export function DashboardKPICards({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    {
      label: "Active Threats",
      value: metrics.activeThreats,
      icon: AlertTriangle,
      tone: "text-orange-400",
    },
    {
      label: "High-Risk Tickets",
      value: metrics.highRiskTickets,
      icon: Flame,
      tone: "text-red-400",
    },
    {
      label: "Auto-Contained",
      value: metrics.autoContained,
      icon: ShieldCheck,
      tone: "text-cyan-400",
    },
    {
      label: "Needs Review",
      value: metrics.needsReview,
      icon: Eye,
      tone: "text-amber-400",
    },
    {
      label: "Blocked IPs",
      value: metrics.blockedIps,
      icon: Ban,
      tone: "text-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Icon className={cn("size-4", tone)} />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </Card>
      ))}

      {/* Queue Health as the sixth KPI — qualitative, not a raw count. */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Queue Health
          </span>
          <Activity className="size-4 text-emerald-400" />
        </div>
        <div className="mt-2.5">
          <QueueHealthBadge health={metrics.queueHealth} />
        </div>
      </Card>
    </div>
  );
}
