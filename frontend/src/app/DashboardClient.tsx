"use client";

import { useEffect, useMemo, useState } from "react";
import { useTicketStore } from "@/stores/ticket.store";
import { useHydrated } from "@/stores/useHydrated";
import { SecurityTicket } from "@/lib/ticket.types";
import { useMockData } from "@/lib/api-client";
import { getTicketPageFromBackend } from "@/lib/tickets.backend.service";
import {
  getDashboardMetricsFromBackend,
  getPerIpBreakdownFromBackend,
  PerIpBreakdown,
} from "@/lib/dashboard.backend.service";
import {
  calculateDashboardMetrics,
  calculateQueueHealth,
  getSeverityDistribution,
  getHighRiskShareOfActive,
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

  // Until the persisted store hydrates on the client, derive against an empty
  // list so server/client markup stays consistent.
  const mockTickets: SecurityTicket[] = hydrated ? storeTickets : [];

  useEffect(() => {
    if (mockMode) return;
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [metrics, perIp, page] = await Promise.all([
          getDashboardMetricsFromBackend(),
          getPerIpBreakdownFromBackend(20),
          getTicketPageFromBackend({ limit: 50, offset: 0 }),
        ]);
        if (cancelled) return;
        setBackendMetrics(metrics);
        setPerIpBreakdown(perIp);
        setBackendTickets(page.tickets);
        setBackendUnavailable(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Dashboard backend unavailable", err);
        setBackendUnavailable(true);
        setBackendMetrics(null);
        setPerIpBreakdown([]);
        setBackendTickets([]);
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
    const backendPerIpDistribution = perIpBreakdown.map((row) => ({
      attack_type: row.source_ip,
      count: row.total_hits,
    }));

    return {
      metrics,
      queueHealth: effectiveQueueHealth,
      severity: getSeverityDistribution(tickets),
      highRiskShare: getHighRiskShareOfActive(tickets),
      attackTypes:
        backendPerIpDistribution.length > 0
          ? backendPerIpDistribution
          : getAttackTypeDistribution(tickets),
      detectionTypes: getDetectionTypeDistribution(tickets),
      defense: getAutomatedDefenseSummary(tickets),
      latestHighRisk: getLatestHighRiskTickets(tickets, 5),
      timeline: getLiveDefenseTimeline(tickets, 8),
      topEndpoints: getTopAttackedEndpoints(tickets, 5),
      fixes: getRecommendedFixesSummary(tickets, 6),
    };
  }, [backendMetrics, perIpBreakdown, tickets]);

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
        metrics={derived.metrics}
        queueHealth={derived.queueHealth}
      />

      {/* Risk breakdown + attack types. items-start so the Attack Type card can
          grow when expanded without stretching Risk Breakdown to match. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <SeverityDonut
          distribution={derived.severity}
          total={derived.metrics.totalTickets}
          highRiskShare={derived.highRiskShare}
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
