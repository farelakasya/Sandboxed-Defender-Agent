"use client";

import Link from "next/link";
import { Activity, Bot, Cog, User, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DefenseFeedItem } from "@/lib/dashboard.utils";
import { formatRelativeTime } from "@/lib/ticket.utils";

const ACTOR_META: Record<string, { icon: LucideIcon; tone: string }> = {
  "AI Defender": { icon: Bot, tone: "text-primary" },
  System: { icon: Cog, tone: "text-muted-foreground" },
  Developer: { icon: User, tone: "text-emerald-400" },
  Admin: { icon: ShieldCheck, tone: "text-orange-400" },
};

export function LiveDefenseTimeline({ events }: { events: DefenseFeedItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <Activity className="size-4 text-primary" />
          Live Defense Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const meta = ACTOR_META[e.actor] ?? ACTOR_META.System;
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background/40"
                    )}
                  >
                    <Icon className={cn("size-3.5", meta.tone)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground/90">{e.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className={meta.tone}>{e.actor}</span> ·{" "}
                      <Link
                        href={`/security/tickets/${e.ticket_id}`}
                        className="font-mono hover:underline"
                      >
                        {e.ticket_id}
                      </Link>{" "}
                      · {formatRelativeTime(e.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
