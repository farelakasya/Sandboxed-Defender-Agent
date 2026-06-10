import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DetectionTypeSummary } from "@/lib/dashboard.utils";
import { detectionTypeBadge } from "@/lib/detectionEvent.types";

/**
 * Detection-type distribution: how many tickets are classified as anomaly /
 * attack / fraud, plus how many carry multiple labels. Multi-label aware —
 * a "fraud + attack + anomaly" ticket counts toward all three.
 *
 * Renders a graceful empty state when no tickets are classified yet (e.g.
 * legacy/mock tickets without a detection_classification).
 */
export function DetectionTypeDistribution({
  summary,
}: {
  summary: DetectionTypeSummary;
}) {
  const max = Math.max(1, ...summary.byType.map((d) => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Layers className="size-4 text-violet-400" />
          Detection Types
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary.classified === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classified detections yet. Run a fraud or attack simulation to
            populate multi-label detections.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {summary.byType.map((d) => (
                <div key={d.type} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-20 shrink-0 rounded-md border px-2 py-0.5 text-center text-xs font-semibold capitalize",
                      detectionTypeBadge(d.type)
                    )}
                  >
                    {d.type}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-violet-500/50"
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                Multi-label detections
              </span>
              <span className="font-semibold text-violet-400">
                {summary.multiLabel} / {summary.classified}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
