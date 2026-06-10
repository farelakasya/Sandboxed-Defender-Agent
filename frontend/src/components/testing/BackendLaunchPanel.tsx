"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Rocket,
  Loader2,
  Ticket as TicketIcon,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getVectorsByDomain } from "@/data/testingVectors";
import { launchSimulation } from "@/lib/testing-launch.service";
import { reportFromLaunchResult } from "@/lib/attacker-report.builder";
import type { AttackerReport } from "@/lib/attacker-report.types";
import type {
  SimulationDomain,
  SimulationLaunchRequest,
  SimulationLaunchResponse,
  SimulationTargetType,
} from "@/lib/testing-launch.types";
import { AttackerReportPanel } from "@/components/reports/AttackerReportPanel";

/**
 * Backend launch panel — the end-to-end launcher.
 *
 * User picks a vector + target → POST /api/testing/launch (our own route) →
 * backend builds the AgentCommand and runs mock or forwards to the collaborator
 * backend → resulting DetectionEvent is stored server-side → DetectionEventSync
 * imports it into the ticket store → dashboard / tickets update.
 *
 * The browser ONLY calls /api/testing/launch. No AWS / collaborator URL here.
 */
export function BackendLaunchPanel({ domain }: { domain: SimulationDomain }) {
  const vectors = useMemo(() => getVectorsByDomain(domain), [domain]);

  const [vectorId, setVectorId] = useState(vectors[0]?.id ?? "");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3001");
  const [endpoint, setEndpoint] = useState("");
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<SimulationLaunchResponse | null>(null);
  const [report, setReport] = useState<AttackerReport | null>(null);
  const [showCommand, setShowCommand] = useState(false);

  const selectedVector = vectors.find((v) => v.id === vectorId) ?? vectors[0];
  const targetType: SimulationTargetType =
    (selectedVector?.target_types[0] as SimulationTargetType) ?? "generic_api";

  async function launch() {
    if (!selectedVector || !baseUrl.trim()) return;
    setLaunching(true);
    setResult(null);
    setReport(null);

    const request: SimulationLaunchRequest = {
      domain,
      vector_id: selectedVector.id,
      target: {
        base_url: baseUrl.trim(),
        endpoint: endpoint.trim() || undefined,
        target_type: targetType,
        environment: "local",
      },
      options: { safe_mode: true },
    };

    const res = await launchSimulation(request);

    setResult(res);
    // Build a structured attacker report from the launch result (uses the
    // collaborator backend's report if present, else synthesizes from the
    // vector). Never creates defender tickets.
    setReport(reportFromLaunchResult(request, selectedVector, res));
    setLaunching(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          <Rocket className="size-4 text-primary" />
          Launch via backend pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Sends the selected vector to{" "}
          <code className="rounded bg-background/40 px-1">
            /api/testing/launch
          </code>
          . The backend builds the agent command, runs it (mock) or forwards it
          to the collaborator backend, and the resulting detection events become
          tickets automatically.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vector
            </label>
            <Select
              value={vectorId}
              onChange={(e) => setVectorId(e.target.value)}
              disabled={launching}
            >
              {vectors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target type
            </label>
            <div className="flex h-9 items-center rounded-lg border border-border bg-background/40 px-3 text-sm text-muted-foreground">
              {targetType}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={launching}
              placeholder="http://host:port"
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Endpoint (optional)
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={launching}
              placeholder="/api/sim-target/..."
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Expected labels for the chosen vector */}
        {selectedVector && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Expected labels:</span>
            {selectedVector.expected_detection_labels.map((l) => (
              <Badge key={l} variant="muted">
                {l}
              </Badge>
            ))}
          </div>
        )}

        <Button onClick={launch} disabled={launching || !baseUrl.trim()}>
          {launching ? <Loader2 className="animate-spin" /> : <Rocket />}
          {launching ? "Launching…" : "Launch Simulation"}
        </Button>

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              result.ok
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{result.status}</Badge>
              <Badge variant="outline">{result.provider}</Badge>
              {result.run_id && (
                <span className="font-mono text-xs text-muted-foreground">
                  {result.run_id}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-foreground/90">{result.message}</p>

            {result.ok && !report && (
              <p className="mt-2 text-xs text-muted-foreground">
                {domain === "fraud"
                  ? "Fraud simulation launched. Waiting for attacker report or defender verdicts…"
                  : "Simulation launched. Waiting for attacker report or defender verdicts…"}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/security/tickets"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <TicketIcon className="size-3.5" />
                Security Tickets
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
            </div>

            {/* Command preview (debug) */}
            {result.command_preview && (
              <div className="mt-3 border-t border-border pt-2">
                <button
                  onClick={() => setShowCommand((s) => !s)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {showCommand ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  Agent command preview (debug)
                </button>
                {showCommand && (
                  <pre className="mt-1.5 max-h-60 overflow-auto rounded-md border border-border bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(result.command_preview, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Structured attacker/fraud report (MVP). Presentation only — does not
            create defender tickets; those come from the defender backend. */}
        {report && <AttackerReportPanel report={report} />}
      </CardContent>
    </Card>
  );
}
