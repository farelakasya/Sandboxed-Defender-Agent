"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Swords,
  Shield,
  Play,
  Square,
  Ticket as TicketIcon,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useTicketStore } from "@/stores/ticket.store";
import {
  ATTACK_KEYS,
  ATTACK_LABELS,
  TARGET_NODES,
  newRunId,
  runAgentTurn,
} from "@/lib/simulation.engine";
import { SimulationAttackKey, SimulationIncidentEvent } from "@/lib/simulation.types";
import { BedrockSetupCard } from "@/components/redteam/BedrockSetupCard";
import { LambdaScanCard } from "@/components/redteam/LambdaScanCard";

interface LogLine {
  id: string;
  team: "red" | "blue";
  text: string;
  tone: "attack" | "blocked" | "breached";
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function RedBlueSimClient() {
  const { toast } = useToast();
  const upsert = useTicketStore((s) => s.upsertTicketFromSimulation);

  const [selectedAttacks, setSelectedAttacks] = useState<SimulationAttackKey[]>([
    "web",
    "fw",
  ]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(["R3", "localweb"]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ attacks: 0, defenses: 0, tickets: 0 });
  const runningRef = useRef(false);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function pushLog(line: LogLine) {
    setLogs((prev) => [...prev.slice(-40), line]);
  }

  /** Handle one emitted event: upsert a ticket and toast with a link. */
  function handleEvent(event: SimulationIncidentEvent) {
    const { ticket, created } = upsert(event);
    setStats((s) => ({ ...s, tickets: s.tickets + (created ? 1 : 0) }));
    toast({
      variant: created ? "alert" : "default",
      title: created
        ? "Security ticket created from simulation"
        : "Security ticket updated from simulation",
      description: `${ticket.ticket_id} · ${ticket.title}`,
    });
    // Stash the latest ticket id so the "View Ticket" CTA can deep-link.
    setLastTicketId(ticket.ticket_id);
  }

  const [lastTicketId, setLastTicketId] = useState<string | null>(null);

  async function runSim() {
    if (selectedAttacks.length === 0 || selectedTargets.length === 0) {
      toast({
        variant: "alert",
        title: "Select at least one vector and target",
      });
      return;
    }
    setRunning(true);
    runningRef.current = true;
    const runId = newRunId();

    const shuffled = [...selectedAttacks].sort(() => Math.random() - 0.5);
    for (const atk of shuffled) {
      if (!runningRef.current) break;

      const event = runAgentTurn(runId, atk, selectedTargets);

      pushLog({
        id: `${event.event_id}-r`,
        team: "red",
        text: `[${event.attack_label}] → ${event.target_node}: ${event.red_message}`,
        tone: "attack",
      });
      setStats((s) => ({ ...s, attacks: s.attacks + 1 }));

      await delay(700 + Math.random() * 500);
      if (!runningRef.current) break;

      pushLog({
        id: `${event.event_id}-b`,
        team: "blue",
        text:
          event.outcome === "blocked"
            ? `[Blocked] ${event.blue_message}`
            : `[Alert] ${event.blue_message} — partial breach detected!`,
        tone: event.outcome,
      });
      setStats((s) => ({ ...s, defenses: s.defenses + 1 }));

      // Emit the structured event → ticketing pipeline.
      handleEvent(event);

      await delay(500 + Math.random() * 400);
    }

    runningRef.current = false;
    setRunning(false);
  }

  function stopSim() {
    runningRef.current = false;
    setRunning(false);
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
            View latest ticket
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <ShieldAlert className="size-4 text-primary" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Red/Blue Team Simulation
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Live attacker vs. defender scenario over the talos.edu topology. Each
          turn emits a structured event that creates or updates a security
          ticket.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Stat label="Attacks launched" value={stats.attacks} tone="text-red-400" />
          <Stat label="Defenses triggered" value={stats.defenses} tone="text-blue-400" />
          <Stat label="Tickets created" value={stats.tickets} tone="text-primary" />
        </div>
      </div>

      {/* Lambda Claude red-team scan — calls the server-side SigV4 proxy
          (/api/redteam/scan), imports findings into the ticket store. */}
      <LambdaScanCard />

      {/* Bedrock red-team setup — API-loaded attacker personas + dummy targets.
          Separate, controlled pipeline that feeds the ticket store via the
          RedTeamEventSync bridge. The in-app visual sim below is unchanged. */}
      <BedrockSetupCard />

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Swords className="size-4 text-primary" />
            Configure run (in-app visual sim)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attack vectors
            </p>
            <div className="flex flex-wrap gap-2">
              {ATTACK_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedAttacks((a) => toggle(a, k))}
                  disabled={running}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                    selectedAttacks.includes(k)
                      ? "border-red-500/40 bg-red-500/15 text-red-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ATTACK_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target nodes
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGET_NODES.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTargets((a) => toggle(a, t))}
                  disabled={running}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors disabled:opacity-50",
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
          </div>
        </CardContent>
      </Card>

      {/* Log panels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LogPanel
          title="Red team — attacker"
          icon={<Swords className="size-4 text-red-400" />}
          color="text-red-400"
          logs={redLogs}
          empty="Waiting for simulation to start…"
        />
        <LogPanel
          title="Blue team — defender"
          icon={<Shield className="size-4 text-blue-400" />}
          color="text-blue-400"
          logs={blueLogs}
          empty="Monitoring all systems — standby…"
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        In-app simulation · emits structured events · tickets persist to the
        shared store.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </div>
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
