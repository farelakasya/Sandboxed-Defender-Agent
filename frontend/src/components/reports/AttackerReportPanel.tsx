"use client";

import Link from "next/link";
import {
  Crosshair,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowRight,
  Ticket as TicketIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AttackerReport,
  AttackerReportSeverity,
  AttackerReportStepStatus,
} from "@/lib/attacker-report.types";
import { getLinkedTicketIdsFromReport } from "@/lib/report-ticket-correlation";

const SEVERITY_TONE: Record<AttackerReportSeverity, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-amber-400",
  HIGH: "text-orange-400",
  CRITICAL: "text-red-400",
};

const STEP_META: Record<
  AttackerReportStepStatus,
  { tone: string; label: string }
> = {
  attempted: { tone: "text-amber-400", label: "Attempted" },
  blocked: { tone: "text-emerald-400", label: "Blocked" },
  succeeded: { tone: "text-red-400", label: "Succeeded" },
  failed: { tone: "text-muted-foreground", label: "Failed" },
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums text-foreground", tone)}>
        {value}
      </p>
    </div>
  );
}

export function AttackerReportPanel({ report }: { report: AttackerReport }) {
  const sev = report.summary.highest_severity;
  const defender = report.defender_result;
  // Explicit links from findings + defender_result (de-duplicated).
  const linkedTicketIds = getLinkedTicketIdsFromReport(report);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm">
          <Crosshair className="size-4 text-primary" />
          Attacker Report
          <Badge variant="outline" className="ml-1 capitalize">
            {report.domain}
          </Badge>
          <Badge variant="muted" className="capitalize">
            {report.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Identity */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <Meta label="Report ID" value={report.report_id} mono />
          <Meta label="Run ID" value={report.run_id} mono />
          <Meta label="Vector" value={report.vector_name} />
          <Meta
            label="Target"
            value={
              report.target.endpoint ??
              report.target.target_type ??
              report.target.base_url ??
              "—"
            }
            mono
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Steps" value={report.summary.total_steps} />
          <StatCard
            label="Succeeded"
            value={report.summary.successful_steps}
            tone="text-red-400"
          />
          <StatCard
            label="Blocked"
            value={report.summary.blocked_steps}
            tone="text-emerald-400"
          />
          <StatCard label="Findings" value={report.summary.findings_count} />
          <StatCard
            label="Top severity"
            value={sev ?? "—"}
            tone={sev ? SEVERITY_TONE[sev] : undefined}
          />
        </div>

        {/* Steps */}
        {report.steps.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Steps
            </p>
            <ul className="space-y-1.5">
              {report.steps.map((step) => {
                const meta = STEP_META[step.status];
                return (
                  <li
                    key={step.step_id}
                    className="flex items-start gap-2 rounded-md border border-border bg-background/30 px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 font-semibold",
                        meta.tone
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="min-w-0">
                      <span className="text-foreground">{step.label}</span>
                      {step.evidence && (
                        <span className="block text-muted-foreground">
                          {step.evidence}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Findings */}
        {report.findings.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Findings
            </p>
            <ul className="space-y-2">
              {report.findings.map((f) => (
                <li
                  key={f.finding_id}
                  className="rounded-md border border-border bg-background/30 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        SEVERITY_TONE[f.severity]
                      )}
                    >
                      {f.severity}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {f.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.description}
                  </p>
                  {f.recommendation && (
                    <p className="mt-1 text-xs text-foreground/80">
                      <span className="text-muted-foreground">Fix: </span>
                      {f.recommendation}
                    </p>
                  )}
                  {f.mapped_ticket_id && (
                    <Link
                      href={`/security/tickets/${f.mapped_ticket_id}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <TicketIcon className="size-3.5" />
                      {f.mapped_ticket_id}
                      <ArrowRight className="size-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Defender result */}
        {defender && (
          <div className="rounded-lg border border-border bg-background/30 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Defender result
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                {defender.detected ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="size-3.5 text-muted-foreground" />
                )}
                {defender.detected ? "Detected" : "Not detected"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {defender.contained ? (
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                ) : (
                  <ShieldX className="size-3.5 text-amber-400" />
                )}
                {defender.contained ? "Contained" : "Not contained"}
              </span>
            </div>

            {defender.mitigation_actions &&
              defender.mitigation_actions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Mitigations:
                  </span>
                  {defender.mitigation_actions.map((m) => (
                    <Badge key={m} variant="muted">
                      <Ban className="size-3" />
                      {m}
                    </Badge>
                  ))}
                </div>
              )}

            {linkedTicketIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedTicketIds.map((id) => (
                  <Link
                    key={id}
                    href={`/security/tickets/${id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <TicketIcon className="size-3.5" />
                    {id}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No linked defender ticket yet. Tickets will appear once the
                defender backend records the verdict.
              </p>
            )}
          </div>
        )}

        {/* Link back to the defender side */}
        <Link
          href="/security/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <TicketIcon className="size-3.5" />
          View Security Tickets
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate text-right font-medium text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}
