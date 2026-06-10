import { AlertTriangle, Flame, ShieldCheck, Eye, Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardMetrics, QueueHealthResult } from "@/lib/dashboard.utils";
import { QueueHealthCard } from "./QueueHealthCard";

/**
 * Six product-focused KPIs. Intentionally NO "Developer Notifications" KPI —
 * dev notification is assumed to happen automatically for every ticket.
 */
export function DashboardKPICards({
  metrics,
  queueHealth,
}: {
  metrics: DashboardMetrics;
  queueHealth: QueueHealthResult;
}) {
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
        <Card key={label} className="flex h-[150px] flex-col justify-between p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Icon className={cn("size-4", tone)} />
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </Card>
      ))}

      {/* Queue Health as the sixth KPI — qualitative, with explanation popover. */}
      <QueueHealthCard health={queueHealth} />
    </div>
  );
}
