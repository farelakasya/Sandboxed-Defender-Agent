"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { QueueTab, SecurityTicket } from "@/lib/ticket.types";
import { calculateQueueMetrics } from "@/lib/ticket.utils";
import { useMockData } from "@/lib/api-client";
import { getTicketPageFromBackend } from "@/lib/tickets.backend.service";
import { useTicketStore } from "@/stores/ticket.store";
import { useHydrated } from "@/stores/useHydrated";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { TicketQueueHeader } from "@/components/tickets/TicketQueueHeader";
import { TicketKPICards } from "@/components/tickets/TicketKPICards";
import { QueueHealthBanner } from "@/components/tickets/QueueHealthBanner";
import {
  TicketFilters,
  QueueFilters,
  DEFAULT_FILTERS,
} from "@/components/tickets/TicketFilters";
import { TicketTable } from "@/components/tickets/TicketTable";

const TABS: { id: QueueTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "p1_critical", label: "P1 Critical" },
  { id: "needs_review", label: "Needs Review" },
  { id: "auto_contained", label: "Auto-Contained" },
  { id: "grouped", label: "Grouped Campaigns" },
  { id: "resolved", label: "Resolved" },
  { id: "suppressed", label: "Suppressed" },
];

const TIME_WINDOWS_MS: Record<QueueFilters["timeRange"], number | null> = {
  all: null,
  "1h": 3_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};

const BACKEND_PAGE_SIZE = 50;

export function TicketQueueClient() {
  const { toast } = useToast();
  const hydrated = useHydrated();
  const mockMode = useMockData();

  // Single source of truth: the shared store. No local copy of ticket data.
  const tickets = useTicketStore((s) => s.tickets);
  const simulateNewTicket = useTicketStore((s) => s.simulateNewTicket);
  const simulateOverload = useTicketStore((s) => s.simulateOverload);
  const resetMockData = useTicketStore((s) => s.resetMockData);

  // UI-only state (not ticket data) stays local to the page.
  const [tab, setTab] = useState<QueueTab>("all");
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_FILTERS);
  const [overloadActive, setOverloadActive] = useState(false);
  const [suppressionEnabled, setSuppressionEnabled] = useState(true);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [backendTickets, setBackendTickets] = useState<SecurityTicket[]>([]);
  const [backendTotal, setBackendTotal] = useState<number | undefined>();
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Before hydration the store still holds the SSR seed; render against an empty
  // list to keep server/client markup consistent, then swap in real data.
  const mockTickets: SecurityTicket[] = hydrated ? tickets : [];
  const data: SecurityTicket[] =
    !mockMode ? (backendError ? mockTickets : backendTickets) : mockTickets;

  async function loadBackendTickets(offset = 0) {
    if (mockMode) return;
    setBackendLoading(true);
    setBackendError(null);
    try {
      const page = await getTicketPageFromBackend({
        limit: BACKEND_PAGE_SIZE,
        offset,
      });
      setBackendTickets((current) =>
        offset === 0 ? page.tickets : [...current, ...page.tickets]
      );
      setBackendTotal(page.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Backend unavailable.";
      console.error("Ticket backend unavailable", err);
      setBackendError(message);
    } finally {
      setBackendLoading(false);
    }
  }

  useEffect(() => {
    if (mockMode) return;
    loadBackendTickets(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]);

  const metrics = useMemo(() => calculateQueueMetrics(data), [data]);

  const attackTypes = useMemo(
    () => Array.from(new Set(data.map((t) => t.attack_type))).sort(),
    [data]
  );
  const endpoints = useMemo(
    () => Array.from(new Set(data.map((t) => t.affected_endpoint))).sort(),
    [data]
  );

  function applyTab(t: SecurityTicket): boolean {
    switch (tab) {
      case "p1_critical":
        return t.priority === "P1" || t.severity === "CRITICAL";
      case "needs_review":
        return t.status === "needs_review";
      case "auto_contained":
        return t.status === "auto_contained";
      case "grouped":
        return t.is_grouped;
      case "resolved":
        return t.status === "resolved" || t.status === "false_positive";
      case "suppressed":
        return (t.suppressed_event_count ?? 0) > 0;
      case "all":
      default:
        return true;
    }
  }

  function applyFilters(t: SecurityTicket): boolean {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      const hay = [
        t.ticket_id,
        t.title,
        t.attack_type,
        t.affected_endpoint,
        t.source_ip ?? "",
        t.user_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.severity !== "all" && t.severity !== filters.severity) return false;
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.attackType !== "all" && t.attack_type !== filters.attackType)
      return false;
    if (filters.endpoint !== "all" && t.affected_endpoint !== filters.endpoint)
      return false;
    const window = TIME_WINDOWS_MS[filters.timeRange];
    if (window !== null) {
      const age = Date.now() - new Date(t.last_seen).getTime();
      if (age > window) return false;
    }
    return true;
  }

  const visibleTickets = useMemo(
    () => data.filter((t) => applyTab(t) && applyFilters(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tab, filters]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<QueueTab, number> = {
      all: data.length,
      p1_critical: 0,
      needs_review: 0,
      auto_contained: 0,
      grouped: 0,
      resolved: 0,
      suppressed: 0,
    };
    for (const t of data) {
      if (t.priority === "P1" || t.severity === "CRITICAL") counts.p1_critical++;
      if (t.status === "needs_review") counts.needs_review++;
      if (t.status === "auto_contained") counts.auto_contained++;
      if (t.is_grouped) counts.grouped++;
      if (t.status === "resolved" || t.status === "false_positive")
        counts.resolved++;
      if ((t.suppressed_event_count ?? 0) > 0) counts.suppressed++;
    }
    return counts;
  }, [data]);

  // Clear row highlight after a few seconds.
  useEffect(() => {
    if (highlightedIds.length === 0) return;
    const id = setTimeout(() => setHighlightedIds([]), 4000);
    return () => clearTimeout(id);
  }, [highlightedIds]);

  function handleSimulateNew() {
    if (!mockMode) {
      toast({
        title: "Backend mode active",
        description: "Set NEXT_PUBLIC_USE_MOCK_DATA=true to use demo simulations.",
      });
      return;
    }
    const created = simulateNewTicket();
    if (!created) return;
    setHighlightedIds([created.ticket_id]);
    setTab("all");
    toast({
      variant: "alert",
      title: "New attack ticket created",
      description: `${created.ticket_id} · ${created.title}`,
    });
  }

  function handleSimulateOverload() {
    if (!mockMode) {
      toast({
        title: "Backend mode active",
        description: "Set NEXT_PUBLIC_USE_MOCK_DATA=true to use demo simulations.",
      });
      return;
    }
    const campaign = simulateOverload();
    if (!campaign) return;
    setOverloadActive(true);
    setHighlightedIds([campaign.ticket_id]);
    toast({
      variant: "alert",
      title: "Queue overload simulated",
      description: `Events grouped into ${campaign.ticket_id}; duplicates suppressed.`,
    });
  }

  function handleReset() {
    if (!mockMode) {
      loadBackendTickets(0);
      return;
    }
    resetMockData();
    setOverloadActive(false);
    setSuppressionEnabled(true);
    setHighlightedIds([]);
    setTab("all");
    setFilters(DEFAULT_FILTERS);
    toast({ title: "Demo data reset", description: "Restored original mock tickets." });
  }

  const groupedTickets = data.filter((t) => t.is_grouped);
  const totalGroupedEvents = groupedTickets.reduce(
    (sum, t) => sum + (t.grouped_event_count ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <TicketQueueHeader
        onSimulateNew={handleSimulateNew}
        onSimulateOverload={handleSimulateOverload}
        busy={backendLoading}
      />

      {!mockMode && backendError && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Backend unavailable — showing mock/local data. {backendError}
          </span>
          <Button size="sm" variant="outline" onClick={() => loadBackendTickets(0)}>
            Retry
          </Button>
        </div>
      )}

      <TicketKPICards metrics={metrics} />

      {overloadActive && suppressionEnabled && (
        <QueueHealthBanner
          groupedEventCount={totalGroupedEvents}
          campaignCount={groupedTickets.length}
          suppressedEventCount={metrics.suppressedEvents}
          onReviewGrouped={() => {
            setTab("grouped");
            toast({ title: "Filtered to grouped campaigns" });
          }}
          onApplyBulk={() =>
            toast({
              variant: "success",
              title: "Bulk actions applied",
              description: "Recommended containment applied to grouped campaigns.",
            })
          }
          onDisableSuppression={() => {
            setSuppressionEnabled(false);
            toast({
              title: "Suppression disabled",
              description: "Duplicate low-risk alerts will no longer be suppressed.",
            });
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                tab === t.id
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tabCounts[t.id]}
            </span>
          </button>
        ))}
      </div>

      <TicketFilters
        filters={filters}
        onChange={setFilters}
        attackTypes={attackTypes}
        endpoints={endpoints}
      />

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          Showing {visibleTickets.length} of {data.length} tickets
          {!mockMode && backendTotal !== undefined ? ` loaded (${backendTotal} total)` : ""}
        </span>
        <div className="flex items-center gap-3">
          {!suppressionEnabled && (
            <span className="text-amber-400">Suppression disabled</span>
          )}
          <Button size="sm" variant="ghost" onClick={handleReset}>
            <RotateCcw />
            {mockMode ? "Reset Demo Data" : "Refresh"}
          </Button>
        </div>
      </div>

      {!mockMode && backendLoading && backendTickets.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading backend tickets…
        </div>
      )}

      <TicketTable tickets={visibleTickets} highlightedIds={highlightedIds} />

      {!mockMode &&
        !backendError &&
        (backendTotal === undefined || backendTickets.length < backendTotal) && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => loadBackendTickets(backendTickets.length)}
              disabled={backendLoading}
            >
              {backendLoading ? "Loading…" : "Load More"}
            </Button>
          </div>
        )}
    </div>
  );
}
