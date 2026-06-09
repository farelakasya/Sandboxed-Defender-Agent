import {
  Inbox,
  Flame,
  ShieldCheck,
  Eye,
  Ban,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { QueueMetrics } from "@/lib/ticket.types";

interface KpiDef {
  key: keyof QueueMetrics;
  label: string;
  icon: typeof Inbox;
  tone: string;
}

const KPIS: KpiDef[] = [
  { key: "open", label: "Open Tickets", icon: Inbox, tone: "text-blue-400" },
  {
    key: "criticalHigh",
    label: "Critical / High",
    icon: Flame,
    tone: "text-red-400",
  },
  {
    key: "autoContained",
    label: "Auto-Contained",
    icon: ShieldCheck,
    tone: "text-cyan-400",
  },
  { key: "needsReview", label: "Needs Review", icon: Eye, tone: "text-amber-400" },
  { key: "blockedIps", label: "Blocked IPs", icon: Ban, tone: "text-orange-400" },
  {
    key: "suppressedEvents",
    label: "Suppressed Events",
    icon: Filter,
    tone: "text-violet-400",
  },
];

export function TicketKPICards({ metrics }: { metrics: QueueMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {KPIS.map(({ key, label, icon: Icon, tone }) => (
        <Card key={key} className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Icon className={cn("size-4", tone)} />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {metrics[key]}
          </p>
        </Card>
      ))}
    </div>
  );
}
