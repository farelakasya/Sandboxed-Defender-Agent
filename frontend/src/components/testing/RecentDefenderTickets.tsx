"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Ticket as TicketIcon, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMockData } from "@/lib/api-client";
import { getTicketPageFromBackend } from "@/lib/tickets.backend.service";
import { formatDetectedAt } from "@/lib/ticket.utils";
import type { SecurityTicket } from "@/lib/ticket.types";

/**
 * "Possible related defender tickets" surfaced on the launch page.
 *
 * The attacker backend does NOT create or correlate defender tickets — the
 * defender backend is the sole source of truth. After a scan we simply re-fetch
 * the most recent defender tickets so the operator can eyeball whether the
 * defender recorded anything around the same time/target. Matches are labelled
 * POSSIBLE (endpoint/host + time heuristic) and never asserted as caused by the
 * scan, because the backend returns no scan_id / correlation field.
 *
 * Backend mode only — in mock mode there is no defender backend to query.
 */

const PAGE = 50;
const SHOWN = 6;

export function RecentDefenderTickets({
  target,
  refreshSignal,
  launchedAtMs,
}: {
  /** Target of the active scan, used purely to flag POSSIBLE matches. */
  target: { ip: string; endpoint: string } | null;
  /** Bump this (e.g. scan status) to trigger an auto-refresh on terminal. */
  refreshSignal?: string;
  /** When the scan was launched — tickets created after this are "recent". */
  launchedAtMs?: number;
}) {
  const mockMode = useMockData();
  const [tickets, setTickets] = useState<SecurityTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (mockMode) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getTicketPageFromBackend({
        limit: PAGE,
        offset: 0,
        sort: "created_at",
        order: "desc",
      });
      setTickets(page.tickets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Defender backend unavailable.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [mockMode]);

  // Refresh whenever the scan signal changes (e.g. reaches a terminal status).
  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  if (mockMode) return null;

  // POSSIBLE-match heuristic: same endpoint or host, created after launch. This
  // is a hint only — NOT a confirmed link.
  const isPossibleMatch = (t: SecurityTicket): boolean => {
    if (!target) return false;
    const afterLaunch =
      launchedAtMs === undefined
        ? true
        : new Date(t.created_at).getTime() >= launchedAtMs - 60_000;
    const endpointMatch =
      !!t.affected_endpoint && t.affected_endpoint === target.endpoint;
    const hostMatch = !!t.source_ip && t.source_ip === target.ip;
    return afterLaunch && (endpointMatch || hostMatch);
  };

  const shown = tickets.slice(0, SHOWN);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="justify-between text-sm">
          <span className="flex items-center gap-2">
            <TicketIcon className="size-4 text-primary" />
            Possible related defender tickets
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Recent defender tickets after this scan, from the defender backend. The
          attacker backend does not create or link tickets, so these are{" "}
          <span className="font-medium text-foreground/80">possible</span> matches
          (by endpoint/host &amp; time) — not confirmed links to this scan.
        </p>

        {error ? (
          <p className="text-xs text-amber-400">
            Defender backend unavailable — {error}
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm italic text-muted-foreground/60">
            {loading ? "Loading…" : "N/A — no recent defender tickets."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {shown.map((t) => {
              const possible = isPossibleMatch(t);
              return (
                <li key={t.ticket_id}>
                  <Link
                    href={`/security/tickets/${t.ticket_id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[11px] text-foreground">
                        {t.ticket_id}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {t.title || "N/A"}
                      </span>
                      {possible && (
                        <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Possible match
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <span className="hidden sm:inline">
                        {formatDetectedAt(t.detected_at ?? t.created_at)}
                      </span>
                      <ExternalLink className="size-3" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
