"use client";

import { useMemo } from "react";
import { useTicketStore } from "@/stores/ticket.store";
import { useHydrated } from "@/stores/useHydrated";
import { SecurityTicket } from "@/lib/ticket.types";
import {
  calculateDashboardMetrics,
  calculateQueueHealth,
  getSeverityDistribution,
  getHighRiskShareOfActive,
  getAttackTypeDistribution,
  getAutomatedDefenseSummary,
  getLatestHighRiskTickets,
  getLiveDefenseTimeline,
  getTopAttackedEndpoints,
  getRecommendedFixesSummary,
} from "@/lib/dashboard.utils";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardKPICards } from "@/components/dashboard/DashboardKPICards";
import { SeverityDonut } from "@/components/dashboard/SeverityDonut";
import { AttackTypeDistribution } from "@/components/dashboard/AttackTypeDistribution";
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

  // Until the persisted store hydrates on the client, derive against an empty
  // list so server/client markup stays consistent.
  const tickets: SecurityTicket[] = hydrated ? storeTickets : [];

  const derived = useMemo(() => {
    return {
      metrics: calculateDashboardMetrics(tickets),
      queueHealth: calculateQueueHealth(tickets),
      severity: getSeverityDistribution(tickets),
      highRiskShare: getHighRiskShareOfActive(tickets),
      attackTypes: getAttackTypeDistribution(tickets),
      defense: getAutomatedDefenseSummary(tickets),
      latestHighRisk: getLatestHighRiskTickets(tickets, 5),
      timeline: getLiveDefenseTimeline(tickets, 8),
      topEndpoints: getTopAttackedEndpoints(tickets, 5),
      fixes: getRecommendedFixesSummary(tickets, 6),
    };
  }, [tickets]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader health={derived.queueHealth.status} />

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
        <AttackTypeDistribution distribution={derived.attackTypes} />
      </div>

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
        All metrics derived live from the ticket store · updates automatically
        on new simulations.
      </p>
    </div>
  );
}
