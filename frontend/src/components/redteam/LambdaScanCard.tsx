"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Radar,
  Loader2,
  Play,
  Ticket as TicketIcon,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTicketStore } from "@/stores/ticket.store";
import { AttackerSelector } from "./AttackerSelector";
import type { AttackerPersona } from "@/lib/attacker.types";
import { scanTarget } from "@/lib/redteam-scan.service";
import type { RedTeamScanResponse } from "@/lib/redteam-scan.types";
import { normalizeSeverity } from "@/lib/redteam-finding-to-ticket.adapter";

/**
 * Lambda Claude red-team scan card.
 *
 * The user enters a target URL + agent count and (optionally) picks an attacker
 * persona for ticket metadata. "Run scan" calls the server-side proxy
 * (POST /api/redteam/scan) — which SigV4-signs the call to the AWS Lambda in
 * external mode, or returns a mock response in mock mode. AWS credentials never
 * touch the browser. On success, findings are imported into the ticket store.
 */

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  INFO: "bg-muted text-muted-foreground border-border",
};

export function LambdaScanCard() {
  const { toast } = useToast();
  const importFindings = useTicketStore((s) => s.importRedTeamFindings);

  const [target, setTarget] = useState("http://localhost:3001");
  const [agents, setAgents] = useState(5);
  const [attacker, setAttacker] = useState<AttackerPersona | null>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<RedTeamScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const canRun = target.trim().length > 0 && !scanning;

  async function run() {
    if (!canRun) return;
    setScanning(true);
    setError(null);
    setResult(null);
    setImported(false);

    const res = await scanTarget({
      target: target.trim(),
      agents,
      attacker_id: attacker?.id,
      attacker_name: attacker?.name,
      safe_mode: true,
    });

    setScanning(false);

    if (!res.ok) {
      const msg = res.error ?? res.message ?? "scan failed";
      setError(msg);
      toast({ variant: "alert", title: "Scan failed", description: msg });
      return;
    }

    setResult(res);

    // Import findings into the ticket store → dashboard/queue update.
    const { createdCount, updatedCount } = importFindings(res, {
      target: target.trim(),
      run_id: res.run_id,
      attacker_id: attacker?.id,
      attacker_name: attacker?.name,
    });
    setImported(true);

    toast({
      variant: "alert",
      title: "Scan completed and findings were added to Security Tickets",
      description: `${createdCount} created · ${updatedCount} updated${
        res.provider ? ` · via ${res.provider}` : ""
      }`,
    });
  }

  // Derive per-severity counts from findings[] (summary only carries total+critical).
  const sevCounts =
    result?.findings?.reduce<Record<string, number>>((acc, f) => {
      const s = normalizeSeverity(f.severity);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {}) ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Radar className="size-4 text-primary" />
          Lambda Claude Red-Team Scan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target + agents */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target URL
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={scanning}
              placeholder="http://host:port"
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agents
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={agents}
              onChange={(e) =>
                setAgents(
                  Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1)))
                )
              }
              disabled={scanning}
              className="w-24 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm tabular-nums text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          More agents = deeper scan but slower (5 is a good default; 10 can take
          minutes).
        </p>

        {/* Optional attacker persona (ticket metadata only) */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attacker profile (optional — ticket metadata)
          </p>
          <AttackerSelector
            selectedId={attacker?.id ?? null}
            onSelect={setAttacker}
          />
        </div>

        {/* Run button */}
        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={run} disabled={!canRun}>
            {scanning ? <Loader2 className="animate-spin" /> : <Play />}
            {scanning ? "Starting red-team scan…" : "Run Lambda scan"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Result preview */}
        {result?.ok && (
          <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="font-medium text-foreground">
                {result.summary?.total ?? result.findings?.length ?? 0} findings
              </span>
              {result.run_id && (
                <Badge variant="muted">run {result.run_id}</Badge>
              )}
              {result.provider && (
                <Badge variant="outline">{result.provider}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(
                (s) =>
                  sevCounts[s] > 0 && (
                    <span
                      key={s}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-semibold",
                        SEVERITY_BADGE[s]
                      )}
                    >
                      {sevCounts[s]} {s}
                    </span>
                  )
              )}
            </div>

            <ul className="space-y-1.5">
              {result.findings?.slice(0, 5).map((f, i) => (
                <li
                  key={`${f.title}-${i}`}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-semibold",
                      SEVERITY_BADGE[normalizeSeverity(f.severity)]
                    )}
                  >
                    {normalizeSeverity(f.severity)}
                  </span>
                  <span className="text-foreground/90">{f.title}</span>
                </li>
              ))}
            </ul>

            {imported && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  Findings were added to Security Tickets.
                </span>
                <Link
                  href="/security/tickets"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <TicketIcon className="size-4" />
                  View Security Tickets
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
