"use client";

import { ListChecks, Lightbulb, ChevronRight, Check, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecommendedAction } from "@/lib/ticket.types";

const PRIORITY_ORDER: RecommendedAction["priority"][] = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABELS: Record<RecommendedAction["priority"], string> = {
  HIGH: "High Priority",
  MEDIUM: "Medium Priority",
  LOW: "Low Priority",
};
const PRIORITY_STYLES: Record<RecommendedAction["priority"], string> = {
  HIGH: "bg-red-500/15 text-red-400 border-red-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const STATUS_STYLES: Record<
  RecommendedAction["status"],
  { badge: string; label: string }
> = {
  todo: { badge: "bg-muted text-muted-foreground border-border", label: "To do" },
  in_progress: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    label: "In progress",
  },
  done: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    label: "Done",
  },
};

function nextStatus(s: RecommendedAction["status"]): RecommendedAction["status"] {
  if (s === "todo") return "in_progress";
  if (s === "in_progress") return "done";
  return "todo";
}

interface Props {
  actions: RecommendedAction[];
  onToggleStatus: (id: string) => void;
}

export function RecommendedActionsList({ actions, onToggleStatus }: Props) {
  const doneCount = actions.filter((a) => a.status === "done").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="justify-between">
          <span className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            Recommended Actions
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{actions.length} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {PRIORITY_ORDER.map((priority) => {
          const group = actions.filter((a) => a.priority === priority);
          if (group.length === 0) return null;
          return (
            <div key={priority} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                    PRIORITY_STYLES[priority]
                  )}
                >
                  {PRIORITY_LABELS[priority]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {group.length} item{group.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {group.map((a) => {
                  const statusStyle = STATUS_STYLES[a.status];
                  const isDone = a.status === "done";
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-lg border border-border bg-background/40 p-3 transition-colors",
                        isDone && "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              className={cn(
                                "text-sm font-semibold text-foreground",
                                isDone &&
                                  "line-through decoration-muted-foreground"
                              )}
                            >
                              {a.title}
                            </h4>
                            <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Tag className="size-3" />
                              {a.category}
                            </span>
                          </div>
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <ChevronRight className="mt-0.5 size-3 shrink-0" />
                            <span>
                              <span className="font-medium text-foreground/80">
                                Why it matters:{" "}
                              </span>
                              {a.why_it_matters}
                            </span>
                          </p>
                          <p className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                            <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400" />
                            <span>
                              <span className="font-medium text-foreground/80">
                                Suggested fix:{" "}
                              </span>
                              {a.suggested_fix}
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            statusStyle.badge
                          )}
                        >
                          {statusStyle.label}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant={isDone ? "secondary" : "outline"}
                          onClick={() => onToggleStatus(a.id)}
                        >
                          {isDone ? (
                            <>
                              <Check />
                              Done
                            </>
                          ) : (
                            <>Mark {nextStatus(a.status).replace("_", " ")}</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
