"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Swords,
  Shield,
  Play,
  Square,
  RotateCcw,
  Ticket as TicketIcon,
  ArrowLeft,
  Bell,
  Wrench,
  Brain,
  ShieldCheck,
  ClipboardList,
  Lock,
  ShieldAlert,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTicketStore } from "@/stores/ticket.store";
import {
  FRAUD_VECTOR_KEYS,
  FRAUD_OWASP,
  FRAUD_TARGETS,
  fraudVectorLabel,
  fraudSourceIpForRun,
  fraudDeviceForRun,
  newFraudRunId,
  runFraudTurn,
  type FraudVectorKey,
} from "@/lib/fraud.engine";
import { normalizeFraudSimulationEventToDetectionEvent } from "@/lib/fraud-to-detection.adapter";
import {
  classifyDetectionEvent,
  analyzeDetectionEvent,
} from "@/lib/detection-pipeline";
import {
  detectionTypeBadge,
  formatDetectionTypes,
  type AnalysisResult,
  type DetectionClassification,
} from "@/lib/detectionEvent.types";
import type { SecurityTicket } from "@/lib/ticket.types";
import { emptyPerVec, type PerVec } from "@/lib/fraud-report.utils";
import { OwaspVulnerabilityReportModal } from "@/components/fraud/OwaspVulnerabilityReportModal";
import { FixAuthFailuresModal } from "@/components/fraud/FixAuthFailuresModal";
import { HardenCheckoutModal } from "@/components/fraud/HardenCheckoutModal";
import { FraudDetectionRulesModal } from "@/components/fraud/FraudDetectionRulesModal";
import { BackendLaunchPanel } from "@/components/testing/BackendLaunchPanel";

interface LogLine {
  id: string;
  team: "red" | "blue";
  text: string;
  tone: "attack" | "blocked" | "breached";
}

type ThreatStatus = "pending" | "active" | "blocked" | "breached";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Latest classify/analyze output shown in the live panels. */
interface LatestAnalysis {
  vector: FraudVectorKey;
  classification: DetectionClassification;
  analysis: AnalysisResult;
  ticket: SecurityTicket;
  created: boolean;
}

export function FraudSimClient() {
  const { toast } = useToast();
  const importDetectionEvent = useTicketStore((s) => s.importDetectionEvent);

  const [selectedVectors, setSelectedVectors] = useState<FraudVectorKey[]>([
    "card",
    "ato",
  ]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([
    "Checkout API",
    "Auth Service",
  ]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({
    attacks: 0,
    defenses: 0,
    blocked: 0,
    breaches: 0,
  });
  // Per-vector tallies (atk/blk/brch) — the OWASP report derives its counts here.
  const [perVec, setPerVec] = useState<PerVec>(() => emptyPerVec());
  const [threatStatus, setThreatStatus] = useState<
    Record<string, ThreatStatus>
  >({});
  const [latest, setLatest] = useState<LatestAnalysis | null>(null);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  /** Which bottom-action modal is open (if any). */
  const [openModal, setOpenModal] = useState<
    null | "owasp" | "fixAuth" | "harden" | "rules"
  >(null);
  const runningRef = useRef(false);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function pushLog(line: LogLine) {
    setLogs((prev) => [...prev.slice(-50), line]);
  }

  /** Risk score: defence share of resolved turns (matches HTML's blue/red bar). */
  const riskScore = useMemo(() => {
    const total = stats.blocked + stats.breaches || 1;
    return Math.round((stats.breaches / total) * 100);
  }, [stats]);

  async function runOneTurn(runId: string, vector: FraudVectorKey) {
    const turn = runFraudTurn(vector, selectedTargets);

    setThreatStatus((s) => ({ ...s, [vector]: "active" }));
    pushLog({
      id: `${runId}-${vector}-r-${Date.now()}`,
      team: "red",
      text: `[${fraudVectorLabel(vector)}] → ${turn.target}: ${turn.red_message}`,
      tone: "attack",
    });
    setStats((s) => ({ ...s, attacks: s.attacks + 1 }));
    setPerVec((p) => ({
      ...p,
      [vector]: { ...p[vector], atk: p[vector].atk + 1 },
    }));

    await delay(700 + Math.random() * 500);
    if (!runningRef.current) return;

    setStats((s) => ({
      ...s,
      defenses: s.defenses + 1,
      blocked: s.blocked + (turn.outcome === "blocked" ? 1 : 0),
      breaches: s.breaches + (turn.outcome === "breached" ? 1 : 0),
    }));
    setPerVec((p) => ({
      ...p,
      [vector]: {
        ...p[vector],
        blk: p[vector].blk + (turn.outcome === "blocked" ? 1 : 0),
        brch: p[vector].brch + (turn.outcome === "breached" ? 1 : 0),
      },
    }));
    setThreatStatus((s) => ({ ...s, [vector]: turn.outcome }));
    pushLog({
      id: `${runId}-${vector}-b-${Date.now()}`,
      team: "blue",
      text:
        turn.outcome === "blocked"
          ? `[Blocked] ${turn.blue_message}`
          : `[Alert] ${turn.blue_message} — partial breach detected!`,
      tone: turn.outcome,
    });

    // ── Unified pipeline: DetectionEvent → classify → analyze → ticket ──
    const event = normalizeFraudSimulationEventToDetectionEvent({
      run_id: runId,
      vector,
      target: turn.target,
      outcome: turn.outcome,
      red_message: turn.red_message,
      blue_message: turn.blue_message,
      source_ip: fraudSourceIpForRun(runId),
      device_id: fraudDeviceForRun(runId),
    });
    const classification = classifyDetectionEvent(event);
    const analysis = analyzeDetectionEvent(event, classification);
    const { ticket, created } = importDetectionEvent(event);

    setLatest({ vector, classification, analysis, ticket, created });
    setLastTicketId(ticket.ticket_id);

    if (created) {
      toast({
        variant: "alert",
        title: "Detection ticket created",
        description: `${ticket.ticket_id} · ${formatDetectionTypes(classification)}`,
      });
    }

    await delay(400 + Math.random() * 300);
  }

  async function runSim() {
    if (selectedVectors.length === 0 || selectedTargets.length === 0) {
      toast({ variant: "alert", title: "Select at least one vector and target" });
      return;
    }
    setRunning(true);
    runningRef.current = true;
    const runId = newFraudRunId();

    // 3 rounds, like the original HTML.
    for (let round = 0; round < 3 && runningRef.current; round++) {
      const shuffled = [...selectedVectors].sort(() => Math.random() - 0.5);
      for (const vector of shuffled) {
        if (!runningRef.current) break;
        await runOneTurn(runId, vector);
      }
    }

    runningRef.current = false;
    setRunning(false);
  }

  function stopSim() {
    runningRef.current = false;
    setRunning(false);
  }

  function resetSim() {
    runningRef.current = false;
    setRunning(false);
    setLogs([]);
    setStats({ attacks: 0, defenses: 0, blocked: 0, breaches: 0 });
    setPerVec(emptyPerVec());
    setThreatStatus({});
    setLatest(null);
    setLastTicketId(null);
  }

  const redLogs = logs.filter((l) => l.team === "red");
  const blueLogs = logs.filter((l) => l.team === "blue");

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <Link
          href="/security/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tickets
        </Link>
        {lastTicketId && (
          <Link
            href={`/security/tickets/${lastTicketId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <TicketIcon className="size-4" />
            View latest detection ticket
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
            <CreditCard className="size-4 text-amber-400" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Fraud Scenario Simulation
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Payment-fraud attacker vs. defender scenarios. Each turn becomes a
          unified Detection Event — classified as fraud / attack / anomaly (or a
          combination) and turned into a Detection Ticket.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Stat label="Fraud attempts" value={stats.attacks} tone="text-red-400" />
          <Stat label="Defences" value={stats.defenses} tone="text-blue-400" />
          <Stat label="Blocked" value={stats.blocked} tone="text-emerald-400" />
          <Stat label="Breaches" value={stats.breaches} tone="text-amber-400" />
          <Stat label="Risk score" value={riskScore} tone="text-primary" suffix="%" />
        </div>
      </div>

      {/* Backend launch — end-to-end vector → /api/testing/launch → tickets. */}
      <BackendLaunchPanel domain="fraud" />

      {/* Controls — in-browser visual sim (kept). */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Swords className="size-4 text-primary" />
            Configure run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fraud vectors
            </p>
            <div className="flex flex-wrap gap-2">
              {FRAUD_VECTOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedVectors((a) => toggle(a, k))}
                  disabled={running}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                    selectedVectors.includes(k)
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {fraudVectorLabel(k)}
                  <span className="rounded bg-background/40 px-1 text-[10px]">
                    {FRAUD_OWASP[k].id}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target systems
            </p>
            <div className="flex flex-wrap gap-2">
              {FRAUD_TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTargets((a) => toggle(a, t))}
                  disabled={running}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                    selectedTargets.includes(t)
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {running ? (
              <Button variant="destructive" onClick={stopSim}>
                <Square />
                Stop
              </Button>
            ) : (
              <Button onClick={runSim}>
                <Play />
                Launch simulation
              </Button>
            )}
            <Button variant="outline" onClick={resetSim} disabled={running}>
              <RotateCcw />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Threat list */}
      {selectedVectors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Threat coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {selectedVectors.map((k) => {
                const status = threatStatus[k] ?? "pending";
                return (
                  <div
                    key={k}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {fraudVectorLabel(k)}
                    </span>
                    <Badge variant="outline">{FRAUD_OWASP[k].id}</Badge>
                    <Badge
                      variant="muted"
                      className={
                        FRAUD_OWASP[k].sev === "HIGH"
                          ? "text-orange-400"
                          : "text-amber-400"
                      }
                    >
                      {FRAUD_OWASP[k].sev}
                    </Badge>
                    <span className="ml-auto">
                      <ThreatBadge status={status} />
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log panels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LogPanel
          title="Red team — fraud actor"
          icon={<Swords className="size-4 text-red-400" />}
          color="text-red-400"
          logs={redLogs}
          empty="Waiting for simulation to start…"
        />
        <LogPanel
          title="Blue team — fraud defence"
          icon={<Shield className="size-4 text-blue-400" />}
          color="text-blue-400"
          logs={blueLogs}
          empty="Monitoring payment systems — standby…"
        />
      </div>

      {/* Unified detection panels */}
      {latest && <DetectionPanels latest={latest} />}

      {/* Bottom action bar — reports, remediation, and the rule editor.
          Ported from the original Fraud Simulation HTML. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reports &amp; remediation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpenModal("owasp")}>
              <ClipboardList />
              OWASP Vulnerability Report
            </Button>
            <Button variant="outline" onClick={() => setOpenModal("fixAuth")}>
              <Lock />
              Fix Auth Failures
            </Button>
            <Button variant="outline" onClick={() => setOpenModal("harden")}>
              <ShieldAlert />
              Harden Checkout
            </Button>
            <Button variant="outline" onClick={() => setOpenModal("rules")}>
              <ListChecks />
              Detection Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Fraud events flow through the same unified detection pipeline as attack
        simulations and Lambda scans · tickets persist to the shared store.
      </p>

      {/* Modals */}
      <OwaspVulnerabilityReportModal
        open={openModal === "owasp"}
        onClose={() => setOpenModal(null)}
        perVec={perVec}
        aggregates={{
          attacks: stats.attacks,
          blocked: stats.blocked,
          breaches: stats.breaches,
        }}
      />
      <FixAuthFailuresModal
        open={openModal === "fixAuth"}
        onClose={() => setOpenModal(null)}
      />
      <HardenCheckoutModal
        open={openModal === "harden"}
        onClose={() => setOpenModal(null)}
      />
      <FraudDetectionRulesModal
        open={openModal === "rules"}
        onClose={() => setOpenModal(null)}
      />
    </div>
  );
}

/* --------------------------------- panels --------------------------------- */

function DetectionPanels({ latest }: { latest: LatestAnalysis }) {
  const { classification, analysis, ticket, created } = latest;
  const dn = analysis.developer_notification;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Classifier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <Brain className="size-4 text-violet-400" />
            Classifier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {[classification.primary_type, ...classification.secondary_types].map(
              (t) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-semibold",
                    detectionTypeBadge(t)
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              )
            )}
            <Badge variant="muted">{classification.severity}</Badge>
            <Badge variant="muted">
              {Math.round(classification.confidence * 100)}% conf
            </Badge>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {classification.reasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <ShieldCheck className="size-4 text-emerald-400" />
            Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-xs leading-relaxed text-foreground/90">
            {analysis.summary}
          </p>
        </CardContent>
      </Card>

      {/* Mitigation actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <ShieldCheck className="size-4 text-cyan-400" />
            Mitigation actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-xs">
            {analysis.mitigation_actions
              .filter((m) => m.action !== "none")
              .map((m, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded border border-border bg-background/40 px-2 py-1.5"
                >
                  <Badge variant="muted" className="shrink-0">
                    {m.action}
                  </Badge>
                  <span className="text-muted-foreground">{m.reason}</span>
                </li>
              ))}
            {analysis.mitigation_actions.filter((m) => m.action !== "none")
              .length === 0 && (
              <li className="text-muted-foreground">
                No automated action needed — low risk.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Developer notification + ticket link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <Bell className="size-4 text-amber-400" />
            Developer notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant="muted"
              className={
                dn.status === "sent"
                  ? "text-emerald-400"
                  : dn.status === "not_required"
                  ? "text-muted-foreground"
                  : "text-amber-400"
              }
            >
              {dn.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              via {dn.channel}
              {dn.recipient ? ` · ${dn.recipient}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {created ? "Detection ticket created" : "Detection ticket updated"}
            </span>
            <Link
              href={`/security/tickets/${ticket.ticket_id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <TicketIcon className="size-4" />
              {ticket.ticket_id}
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Fix recommendations (full width) */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">
            <Wrench className="size-4 text-sky-400" />
            Fix recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.recommended_fixes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No fix recommendations for this event.
            </p>
          ) : (
            <div className="space-y-2">
              {analysis.recommended_fixes.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-border bg-background/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="muted"
                      className={
                        f.priority === "HIGH"
                          ? "text-orange-400"
                          : f.priority === "MEDIUM"
                          ? "text-amber-400"
                          : "text-sky-400"
                      }
                    >
                      {f.priority}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {f.title}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {f.category}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {f.why_it_matters}
                  </p>
                  <p className="mt-1 text-xs text-foreground/80">
                    Fix: {f.suggested_fix}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------- bits ----------------------------------- */

function Stat({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  tone: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>
        {value}
        {suffix ?? ""}
      </p>
    </div>
  );
}

function ThreatBadge({ status }: { status: ThreatStatus }) {
  const map: Record<ThreatStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "text-muted-foreground border-border" },
    active: { label: "Active", cls: "text-amber-400 border-amber-500/30" },
    blocked: { label: "Blocked", cls: "text-emerald-400 border-emerald-500/30" },
    breached: { label: "Breached", cls: "text-red-400 border-red-500/30" },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs font-semibold",
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}

function LogPanel({
  title,
  icon,
  color,
  logs,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  logs: LogLine[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("text-sm", color)}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/40 p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">{empty}</p>
          ) : (
            logs.map((l) => (
              <p
                key={l.id}
                className={cn(
                  "leading-relaxed",
                  l.tone === "attack" && "text-red-300/90",
                  l.tone === "blocked" && "text-emerald-300/90",
                  l.tone === "breached" && "text-amber-300/90"
                )}
              >
                {l.text}
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
