"use client";

import { useEffect, useMemo, useState } from "react";
import { useTicketStore } from "@/stores/ticket.store";
import { useHydrated } from "@/stores/useHydrated";
import { SecurityTicket } from "@/lib/ticket.types";
import type { Severity, DefenderAction } from "@/lib/ticket.types";
import { useMockData } from "@/lib/api-client";
import { getTicketPageFromBackend } from "@/lib/tickets.backend.service";
import {
  getDashboardMetricsFromBackend,
  getPerIpBreakdownFromBackend,
  PerIpBreakdown,
} from "@/lib/dashboard.backend.service";
import {
  getDashboardDistributionsFromBackend,
  getDashboardTimelineFromBackend,
  type DashboardDistributions,
} from "@/lib/dashboard-aggregates.backend.service";
import type { DefenseFeedItem } from "@/lib/dashboard.utils";
import {
  calculateDashboardMetrics,
  calculateQueueHealth,
  getSeverityDistribution,
  getAttackTypeDistribution,
  getDetectionTypeDistribution,
  getAutomatedDefenseSummary,
  getLatestHighRiskTickets,
  getLiveDefenseTimeline,
  getTopAttackedEndpoints,
  getRecommendedFixesSummary,
  DashboardMetrics,
  QueueHealthResult,
} from "@/lib/dashboard.utils";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardKPICards } from "@/components/dashboard/DashboardKPICards";
import { BackendPostureStrip } from "@/components/dashboard/BackendPostureStrip";
import { SeverityDonut } from "@/components/dashboard/SeverityDonut";
import { AttackTypeDistribution } from "@/components/dashboard/AttackTypeDistribution";
import { DetectionTypeDistribution } from "@/components/dashboard/DetectionTypeDistribution";
import { AutomatedDefenseSummary } from "@/components/dashboard/AutomatedDefenseSummary";
import { LatestHighRiskTickets } from "@/components/dashboard/LatestHighRiskTickets";
import { LiveDefenseTimeline } from "@/components/dashboard/LiveDefenseTimeline";
import { TopAttackedEndpoints } from "@/components/dashboard/TopAttackedEndpoints";
import { RecommendedFixesSummary } from "@/components/dashboard/RecommendedFixesSummary";

/**
 * Product-focused security dashboard at "/".
 *
 * Reads the live ticket array straight from the shared Zustand store and
 * derives EVERY metric from it (see lib/dashboard.utils.ts). Because the store
 * is reactive, the dashboard updates automatically when tickets change —
 * including after the red/blue simulator creates new tickets.
 *
 * TODO(api): when a backend lands, dashboard aggregates could be fetched from
 * GET /api/dashboard/metrics; keep the derivation utils as a client fallback.
 */
export function DashboardClient() {
  const hydrated = useHydrated();
  const storeTickets = useTicketStore((s) => s.tickets);
  const mockMode = useMockData();
  const [backendTickets, setBackendTickets] = useState<SecurityTicket[]>([]);
  const [backendMetrics, setBackendMetrics] = useState<DashboardMetrics | null>(
    null
  );
  const [perIpBreakdown, setPerIpBreakdown] = useState<PerIpBreakdown[]>([]);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  // DB-wide aggregates (null until the backend ships these endpoints; the
  // dashboard falls back to client-side derivation when null).
  const [distributions, setDistributions] =
    useState<DashboardDistributions | null>(null);
  const [backendTimeline, setBackendTimeline] = useState<DefenseFeedItem[] | null>(
    null
  );

  // Until the persisted store hydrates on the client, derive against an empty
  // list so server/client markup stays consistent.
  const mockTickets: SecurityTicket[] = hydrated ? storeTickets : [];

  useEffect(() => {
    if (mockMode) return;
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [metrics, perIp, page, dist, timeline] = await Promise.all([
          getDashboardMetricsFromBackend(),
          getPerIpBreakdownFromBackend(20),
          getTicketPageFromBackend({ limit: 50, offset: 0 }),
          // Optional DB-wide aggregates — resolve to null if not yet available.
          getDashboardDistributionsFromBackend(),
          getDashboardTimelineFromBackend(8),
        ]);
        if (cancelled) return;
        setBackendMetrics(metrics);
        setPerIpBreakdown(perIp);
        setBackendTickets(page.tickets);
        setDistributions(dist);
        setBackendTimeline(timeline);
        setBackendUnavailable(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Dashboard backend unavailable", err);
        setBackendUnavailable(true);
        setBackendMetrics(null);
        setPerIpBreakdown([]);
        setBackendTickets([]);
        setDistributions(null);
        setBackendTimeline(null);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [mockMode]);

  const tickets: SecurityTicket[] =
    !mockMode && !backendUnavailable ? backendTickets : mockTickets;

  const derived = useMemo(() => {
    const queueHealth = calculateQueueHealth(tickets);
    const metrics = backendMetrics ?? calculateDashboardMetrics(tickets);
    const effectiveQueueHealth: QueueHealthResult = backendMetrics
      ? {
          status: metrics.queueHealth,
          reason: "Backend aggregate metrics",
          metrics: {
            activeTickets: metrics.activeThreats,
            highRiskTickets: metrics.highRiskTickets,
            recentAttacks15m: 0,
            suppressedEvents: 0,
            groupedEvents: 0,
          },
          triggeredBy: [],
        }
      : queueHealth;
    // Annotate each attacker IP with a contained/blocked marker derived purely
    // from backend data (no hardcoded IPs/counts). The red-team IP surfaces
    // naturally as the dominant, fully-contained bar.
    const backendPerIpDistribution = perIpBreakdown.map((row) => {
      const fullyContained =
        row.total_hits > 0 && row.contained === row.total_hits;
      const marker = fullyContained
        ? " · contained"
        : row.ip_blocked
          ? " · blocked"
          : "";
      return {
        attack_type: `${row.source_ip}${marker}`,
        count: row.total_hits,
      };
    });

    // ── Single source of truth for KPI + Risk Breakdown numbers ───────────
    // Prefer DB-wide distributions; in mock mode (or if the endpoint is down)
    // derive the SAME shape from the loaded tickets so both stay consistent.
    const severity =
      distributions && distributions.bySeverity.length > 0
        ? distributions.bySeverity
        : getSeverityDistribution(tickets);
    const defense =
      distributions && distributions.defense.length > 0
        ? distributions.defense
        : getAutomatedDefenseSummary(tickets);

    const sevCount = (s: Severity) =>
      severity.find((d) => d.severity === s)?.count ?? 0;
    const actionCount = (a: DefenderAction) =>
      defense.find((d) => d.action === a)?.count ?? 0;

    // Detection Volume = sum of all severity buckets (the donut total).
    const detectionVolume =
      sevCount("CRITICAL") + sevCount("HIGH") + sevCount("MEDIUM") + sevCount("LOW");
    // High-Risk = CRITICAL + HIGH only (NOT medium).
    const highRiskTickets = sevCount("CRITICAL") + sevCount("HIGH");
    const highRiskPct =
      detectionVolume > 0
        ? Math.round((highRiskTickets / detectionVolume) * 100)
        : 0;
    // Defender Actions = block_ip + flag_user + rate_limit_ip (excludes "none").
    const defenderActions =
      actionCount("block_ip") +
      actionCount("flag_user") +
      actionCount("rate_limit_ip");
    const blockedActions = actionCount("block_ip");

    const kpiStats = {
      detectionVolume,
      highRiskTickets,
      autoContained: metrics.autoContained,
      defenderActions,
      blockedActions,
    };

    return {
      metrics,
      kpiStats,
      detectionVolume,
      highRiskTickets,
      highRiskPct,
      // Queue Health uses the same high-risk definition as the KPI card.
      queueHealth: {
        ...effectiveQueueHealth,
        metrics: { ...effectiveQueueHealth.metrics, highRiskTickets },
      },
      severity,
      attackTypes:
        backendPerIpDistribution.length > 0
          ? backendPerIpDistribution
          : getAttackTypeDistribution(tickets),
      detectionTypes:
        distributions && distributions.detectionTypes.byType.length > 0
          ? distributions.detectionTypes
          : getDetectionTypeDistribution(tickets),
      defense,
      latestHighRisk: getLatestHighRiskTickets(tickets, 5),
      timeline:
        backendTimeline && backendTimeline.length > 0
          ? backendTimeline
          : getLiveDefenseTimeline(tickets, 8),
      topEndpoints:
        distributions && distributions.topEndpoints.length > 0
          ? distributions.topEndpoints.slice(0, 5)
          : getTopAttackedEndpoints(tickets, 5),
      fixes:
        distributions && distributions.fixes.length > 0
          ? distributions.fixes.slice(0, 6)
          : getRecommendedFixesSummary(tickets, 6),
    };
  }, [backendMetrics, perIpBreakdown, tickets, distributions, backendTimeline]);

  const backendStatus = mockMode
    ? "mock"
    : backendUnavailable
      ? "unavailable"
      : backendMetrics
        ? "connected"
        : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader
        health={derived.queueHealth.status}
        backendStatus={backendStatus}
      />

      <DashboardKPICards
        stats={derived.kpiStats}
        queueHealth={derived.queueHealth}
      />

      {/* Richer backend aggregates (dismissed, flagged/blocked users, auto
          notifications). Renders only when the backend supplies them. */}
      {!mockMode && !backendUnavailable ? (
        <BackendPostureStrip metrics={derived.metrics} />
      ) : null}

      {/* Risk breakdown + attack types. items-start so the Attack Type card can
          grow when expanded without stretching Risk Breakdown to match. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <SeverityDonut
          distribution={derived.severity}
          total={derived.detectionVolume}
          highRiskPct={derived.highRiskPct}
        />
        <AttackTypeDistribution
          distribution={derived.attackTypes}
          title={
            !mockMode && perIpBreakdown.length > 0
              ? "Per-IP Breakdown"
              : "Attack Type Distribution"
          }
          emptyText={
            !mockMode && perIpBreakdown.length > 0
              ? "No attacker IPs recorded yet."
              : "No attacks recorded yet."
          }
          formatLabel={
            !mockMode && perIpBreakdown.length > 0 ? (value) => value : undefined
          }
        />
      </div>

      {/* Unified detection-type distribution (anomaly/attack/fraud, multi-label) */}
      <DetectionTypeDistribution summary={derived.detectionTypes} />

      {/* Automated defense (product value) */}
      <AutomatedDefenseSummary summary={derived.defense} />

      {/* Latest high-risk tickets + live timeline */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LatestHighRiskTickets tickets={derived.latestHighRisk} />
        <LiveDefenseTimeline events={derived.timeline} />
      </div>

      {/* Top endpoints + recommended fixes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <TopAttackedEndpoints endpoints={derived.topEndpoints} />
        <RecommendedFixesSummary fixes={derived.fixes} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {mockMode || backendUnavailable
          ? "All metrics derived live from the ticket store · updates automatically on new simulations."
          : "Dashboard KPIs and per-IP breakdown loaded from the backend · ticket-level widgets use the latest loaded sample."}
      </p>
    </div>
  );
}
