"use client";

import { useRouter } from "next/navigation";
import { Wrench, Lightbulb, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FixSummary } from "@/lib/dashboard.utils";

const PRIORITY_STYLES: Record<FixSummary["priority"], string> = {
  HIGH: "bg-red-500/15 text-red-400 border-red-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export function RecommendedFixesSummary({ fixes }: { fixes: FixSummary[] }) {
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <Wrench className="size-4 text-primary" />
          Recommended Fixes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fixes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No outstanding fixes — all caught up.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {fixes.map((fix) => (
              <button
                key={fix.title}
                type="button"
                // TODO(routing): deep-link to a pre-filtered ticket queue once
                // the queue supports query params (e.g. ?fix=<title>).
                onClick={() => router.push("/security/tickets")}
                className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {fix.title}
                  </h4>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                      PRIORITY_STYLES[fix.priority]
                    )}
                  >
                    {fix.priority}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5">
                    <Tag className="size-3" />
                    {fix.category}
                  </span>
                  <span className="font-semibold text-foreground">
                    {fix.ticketsAffected} ticket
                    {fix.ticketsAffected === 1 ? "" : "s"} affected
                  </span>
                </div>

                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400" />
                  <span>{fix.suggestedFix}</span>
                </p>

                <p className="font-mono text-[11px] text-muted-foreground/70">
                  e.g. {fix.exampleEndpoint}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
