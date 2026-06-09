"use client";

import { AlertTriangle, Layers, ListChecks, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  groupedEventCount: number;
  campaignCount: number;
  suppressedEventCount: number;
  onReviewGrouped: () => void;
  onApplyBulk: () => void;
  onDisableSuppression: () => void;
}

/**
 * Shown only when overload mode is active. Communicates that the system grouped
 * related events into campaign tickets and is suppressing low-risk duplicates.
 */
export function QueueHealthBanner({
  groupedEventCount,
  campaignCount,
  suppressedEventCount,
  onReviewGrouped,
  onApplyBulk,
  onDisableSuppression,
}: Props) {
  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15">
            <AlertTriangle className="size-5 text-orange-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-orange-200">
              Queue overload detected
            </p>
            <p className="text-sm text-orange-100/80">
              {groupedEventCount} related events were grouped into{" "}
              {campaignCount} campaign ticket
              {campaignCount === 1 ? "" : "s"}. {suppressedEventCount} low-risk
              duplicate alerts are temporarily suppressed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onReviewGrouped}>
            <Layers />
            Review grouped events
          </Button>
          <Button size="sm" variant="outline" onClick={onApplyBulk}>
            <ListChecks />
            Apply recommended bulk actions
          </Button>
          <Button size="sm" variant="ghost" onClick={onDisableSuppression}>
            <BellOff />
            Disable suppression
          </Button>
        </div>
      </div>
    </div>
  );
}
