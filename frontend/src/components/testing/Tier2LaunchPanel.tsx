"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Rocket, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  launchPentestScan,
  getPentestScan,
  getPentestScope,
  PentestServiceError,
} from "@/lib/tier2-pentest.service";
import {
  TERMINAL_STATUSES,
  type Scan,
  type ScopeTarget,
} from "@/lib/tier2-pentest.types";
import { PentestScanPanel } from "@/components/reports/PentestScanPanel";

type TargetMode = "preset" | "custom";

const POLL_INTERVAL_MS = 15_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

/**
 * Tier2 AI-Pentest launcher: a bounded, async scan against an authorized target.
 * Launch → store scan_id → poll every ~15s → stop on DONE/FAILED/REJECTED.
 * No vector/domain/options — Opus chooses techniques at runtime.
 */
export function Tier2LaunchPanel() {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("80");
  const [endpoint, setEndpoint] = useState("/login");
  const [authorized, setAuthorized] = useState(false);

  // Preset attack targets from GET /scope. The dropdown toggles between using a
  // preset (ip/port locked from the preset) or creating a custom target.
  const [scopeTargets, setScopeTargets] = useState<ScopeTarget[]>([]);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<TargetMode>("custom");
  const [selectedPreset, setSelectedPreset] = useState("");

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const scanIdRef = useRef<string | null>(null);
  const pollErrorsRef = useRef(0);

  const portNum = Number(port);
  const portValid = Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  const endpointValid = endpoint.trim().startsWith("/");
  const canLaunch =
    !launching && ip.trim() !== "" && portValid && endpointValid && authorized;

  const isTerminal = scan ? TERMINAL_STATUSES.includes(scan.status) : false;

  const poll = useCallback(async () => {
    const id = scanIdRef.current;
    if (!id) return;
    try {
      const next = await getPentestScan(id);
      pollErrorsRef.current = 0;
      setPollError(null);
      setScan(next);
    } catch (e) {
      // Transient blip — keep the scan_id and retry with backoff (don't lose run).
      pollErrorsRef.current += 1;
      const msg = e instanceof Error ? e.message : "poll failed";
      if (pollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        setPollError(`${msg} (giving up after ${MAX_CONSECUTIVE_POLL_ERRORS} retries)`);
      } else {
        setPollError(msg);
      }
    }
  }, []);

  // Poll loop — runs while a scan exists and isn't terminal.
  useEffect(() => {
    if (!scan || TERMINAL_STATUSES.includes(scan.status)) return;
    if (pollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) return;
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [scan, poll]);

  // Load preset targets once on mount. Default to "preset" mode when any exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const targets = await getPentestScope();
        if (cancelled) return;
        setScopeTargets(targets);
        if (targets.length > 0) {
          setTargetMode("preset");
          setSelectedPreset(targets[0].raw);
          setIp(targets[0].host);
          setPort(String(targets[0].port));
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not load preset targets.";
        setScopeError(msg);
      } finally {
        if (!cancelled) setScopeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPreset(raw: string) {
    setSelectedPreset(raw);
    const target = scopeTargets.find((t) => t.raw === raw);
    if (target) {
      setIp(target.host);
      setPort(String(target.port));
    }
  }

  function switchMode(mode: TargetMode) {
    setTargetMode(mode);
    if (mode === "preset" && scopeTargets.length > 0) {
      applyPreset(selectedPreset || scopeTargets[0].raw);
    }
  }

  async function handleLaunch() {
    if (!canLaunch) return;
    setLaunching(true);
    setLaunchError(null);
    setPollError(null);
    setScan(null);
    pollErrorsRef.current = 0;
    try {
      const res = await launchPentestScan({
        ip: ip.trim(),
        port: portNum,
        endpoint: endpoint.trim(),
        authorized: true,
      });
      scanIdRef.current = res.scan_id;
      // Seed a minimal QUEUED scan, then poll immediately for the real object.
      setScan({
        scan_id: res.scan_id,
        status: res.status,
        engine: null,
        target: { ip: ip.trim(), port: portNum, endpoint: endpoint.trim(), url: "" },
        profile: null,
        scenario: null,
        report_url: null,
        error: null,
        created_at: Math.floor(Date.now() / 1000),
        findings: [],
      });
      void poll();
    } catch (e) {
      const msg =
        e instanceof PentestServiceError ? e.message : "Failed to launch scan.";
      setLaunchError(msg);
    } finally {
      setLaunching(false);
    }
  }

  function handleReset() {
    scanIdRef.current = null;
    pollErrorsRef.current = 0;
    setScan(null);
    setPollError(null);
    setLaunchError(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            <Rocket className="size-4 text-primary" />
            Launch AI Pentest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              This launches a real, bounded penetration test against the target you
              specify. Only run it against systems you are explicitly authorized to
              test. Targets are restricted to an allowlist on the backend;
              unauthorized targets are rejected. Runs are rate-limited and capped.
            </p>
          </div>

          {/* Target source: preset (from /scope) or custom. Presets only render
              when the backend returned any. */}
          <div className="space-y-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target
            </span>
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => switchMode("preset")}
                disabled={launching || scopeTargets.length === 0}
                className={`rounded-md px-3 py-1 font-medium transition-colors disabled:opacity-40 ${
                  targetMode === "preset"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Use preset
              </button>
              <button
                type="button"
                onClick={() => switchMode("custom")}
                disabled={launching}
                className={`rounded-md px-3 py-1 font-medium transition-colors disabled:opacity-40 ${
                  targetMode === "custom"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create new
              </button>
            </div>

            {targetMode === "preset" && (
              <div>
                <Select
                  className="h-10 w-full font-mono text-sm"
                  value={selectedPreset}
                  onChange={(e) => applyPreset(e.target.value)}
                  disabled={launching || scopeLoading || scopeTargets.length === 0}
                  aria-label="Preset target"
                >
                  {scopeLoading ? (
                    <option value="">Loading presets…</option>
                  ) : scopeTargets.length === 0 ? (
                    <option value="">No presets available</option>
                  ) : (
                    scopeTargets.map((t) => (
                      <option key={t.raw} value={t.raw}>
                        {t.raw}
                      </option>
                    ))
                  )}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Allowlisted target from the attacker backend. Switch to “Create
                  new” to enter a custom host/port.
                </p>
              </div>
            )}

            {scopeError && targetMode === "preset" && (
              <p className="text-xs text-amber-400">
                Couldn’t load presets ({scopeError}). Use “Create new” instead.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target IP / host
              </label>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                disabled={launching}
                readOnly={targetMode === "preset"}
                placeholder="54.84.126.64"
                className={`w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50 ${
                  targetMode === "preset" ? "cursor-not-allowed opacity-70" : ""
                }`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={launching}
                readOnly={targetMode === "preset"}
                placeholder="80"
                min={1}
                max={65535}
                className={`w-full rounded-lg border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50 ${
                  port && !portValid ? "border-red-500/50" : "border-border"
                } ${targetMode === "preset" ? "cursor-not-allowed opacity-70" : ""}`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Endpoint
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={launching}
              placeholder="/login"
              className={`w-full rounded-lg border bg-background/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-50 ${
                endpoint && !endpointValid ? "border-red-500/50" : "border-border"
              }`}
            />
            {endpoint && !endpointValid && (
              <p className="mt-1 text-xs text-red-400">Endpoint must start with “/”.</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs text-foreground/90">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              disabled={launching}
              className="mt-0.5 size-4 rounded border-border"
            />
            <span>
              I confirm I am explicitly authorized to run a penetration test against
              this target.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={handleLaunch} disabled={!canLaunch}>
              {launching ? <Loader2 className="animate-spin" /> : <Rocket />}
              {launching ? "Launching…" : "Launch Scan"}
            </Button>
            {scan && (
              <Button variant="ghost" onClick={handleReset} disabled={launching}>
                New scan
              </Button>
            )}
          </div>

          {launchError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
              {launchError}
            </div>
          )}
        </CardContent>
      </Card>

      {scan && <PentestScanPanel scan={scan} pollError={pollError} />}

      {scan && !isTerminal && !pollError && (
        <p className="text-center text-xs text-muted-foreground">
          Scan in progress — polling every 15s. You can leave this open.
        </p>
      )}
    </div>
  );
}
