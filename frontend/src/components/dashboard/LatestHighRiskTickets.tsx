"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Check, Minus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityTicket } from "@/lib/ticket.types";
import { humanizeAttackType, getSeverityStyle } from "@/lib/ticket.utils";
import { cn } from "@/lib/utils";
import { TicketSeverityBadge } from "@/components/tickets/TicketSeverityBadge";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";

export function LatestHighRiskTickets({
  tickets,
}: {
  tickets: SecurityTicket[];
}) {
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="justify-between">
          <span className="flex items-center gap-2">
            <Flame className="size-4 text-red-400" />
            Latest High-Risk Tickets
          </span>
          <Link
            href="/security/tickets"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active high-risk tickets. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Severity</th>
                  <th className="py-2 pr-3 font-medium">Ticket</th>
                  <th className="hidden py-2 pr-3 font-medium md:table-cell">
                    Attack Type
                  </th>
                  <th className="hidden py-2 pr-3 font-medium lg:table-cell">
                    Endpoint
                  </th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">AI Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => {
                  const sev = getSeverityStyle(t.severity);
                  return (
                    <tr
                      key={t.ticket_id}
                      onClick={() =>
                        router.push(`/security/tickets/${t.ticket_id}`)
                      }
                      className={cn(
                        "cursor-pointer border-l-2 transition-colors hover:bg-muted/40",
                        sev.accent
                      )}
                    >
                      <td className="py-2.5 pr-3">
                        <TicketSeverityBadge severity={t.severity} withIcon={false} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-mono text-xs text-muted-foreground">
                          {t.ticket_id}
                        </div>
                        <div className="max-w-[200px] truncate font-medium text-foreground">
                          {t.title}
                        </div>
                      </td>
                      <td className="hidden py-2.5 pr-3 text-xs text-muted-foreground md:table-cell">
                        {humanizeAttackType(t.attack_type)}
                      </td>
                      <td className="hidden py-2.5 pr-3 font-mono text-xs lg:table-cell">
                        {t.affected_endpoint}
                      </td>
                      <td className="py-2.5 pr-3">
                        <TicketStatusBadge status={t.status} />
                      </td>
                      <td className="py-2.5">
                        {t.action_taken ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                            <Check className="size-3.5" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3.5" />
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
