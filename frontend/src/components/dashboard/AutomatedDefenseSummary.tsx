import {
  Ban,
  Gauge,
  Flag,
  Bell,
  UserCog,
  MinusCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DefenseSummaryItem } from "@/lib/dashboard.utils";
import { DefenderAction } from "@/lib/ticket.types";

const ICONS: Record<DefenderAction, { icon: LucideIcon; tone: string }> = {
  block_ip: { icon: Ban, tone: "text-red-400" },
  rate_limit_ip: { icon: Gauge, tone: "text-orange-400" },
  flag_user: { icon: Flag, tone: "text-amber-400" },
  notify_admin: { icon: Bell, tone: "text-violet-400" },
  notify_dev: { icon: UserCog, tone: "text-sky-400" },
  none: { icon: MinusCircle, tone: "text-muted-foreground" },
};

/**
 * Sells the product value: the platform doesn't just detect — it responds
 * automatically. Each tile is a count of tickets where the AI took that action.
 */
export function AutomatedDefenseSummary({
  summary,
}: {
  summary: DefenseSummaryItem[];
}) {
  const totalActions = summary
    .filter((s) => s.action !== "none")
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" />
            Automated Defense
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {totalActions} actions taken
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary.map(({ action, label, count }) => {
            const { icon: Icon, tone } = ICONS[action];
            return (
              <div
                key={action}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-background/40 p-3"
              >
                <Icon className={cn("size-4 shrink-0", tone)} />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none tabular-nums text-foreground">
                    {count}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The AI defender contained these threats automatically — no manual
          intervention required.
        </p>
      </CardContent>
    </Card>
  );
}
