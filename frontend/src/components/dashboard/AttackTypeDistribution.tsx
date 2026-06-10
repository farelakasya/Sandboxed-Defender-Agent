"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackTypeCount } from "@/lib/dashboard.utils";
import { humanizeAttackType } from "@/lib/ticket.utils";

const TOP_N = 5;

export function AttackTypeDistribution({
  distribution,
  title = "Attack Type Distribution",
  emptyText = "No attacks recorded yet.",
  formatLabel = humanizeAttackType,
}: {
  distribution: AttackTypeCount[];
  title?: string;
  emptyText?: string;
  formatLabel?: (value: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const max = Math.max(1, ...distribution.map((d) => d.count));
  // Sort descending by count without mutating the incoming array.
  const sorted = [...distribution].sort((a, b) => b.count - a.count);
  const canToggle = sorted.length > TOP_N;
  const visible = expanded ? sorted : sorted.slice(0, TOP_N);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <TrendingUp className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <>
            <ul
              className={
                // Cap height + scroll only when expanded and the list is long.
                expanded && sorted.length > 8
                  ? "max-h-[500px] space-y-3 overflow-y-auto pr-1"
                  : "space-y-3"
              }
            >
              {visible.map((d) => (
                <li key={d.attack_type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {formatLabel(d.attack_type)}
                    </span>
                    <span className="font-semibold tabular-nums text-muted-foreground">
                      {d.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {canToggle && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-3 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                {expanded
                  ? "Show less"
                  : `Show all attack types (${sorted.length})`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
