import { apiGet } from "./api-client";
import type { DashboardMetrics } from "./dashboard.utils";

export type PerIpBreakdown = {
  source_ip: string;
  total_hits: number;
  ongoing: number;
  contained: number;
  dismissed: number;
  max_confidence: number;
  severity: string;
  first_seen: string;
  last_seen: string;
  reasons: string;
  ip_blocked: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function queueHealthFromMetrics(metrics: DashboardMetrics): DashboardMetrics["queueHealth"] {
  if (metrics.activeThreats >= 50 || metrics.highRiskTickets >= 15) return "Overloaded";
  if (metrics.activeThreats >= 20 || metrics.highRiskTickets >= 5) return "Busy";
  return "Stable";
}

export function normalizeBackendDashboardMetrics(rawValue: unknown): DashboardMetrics {
  const raw = asRecord(rawValue);
  const metrics: DashboardMetrics = {
    activeThreats: asNumber(raw.ongoing ?? raw.open_incidents),
    highRiskTickets: asNumber(raw.high_risk_tickets ?? raw.highRiskTickets),
    autoContained: asNumber(raw.contained ?? raw.auto_contained),
    needsReview: asNumber(raw.needs_review ?? raw.ongoing),
    blockedIps: asNumber(raw.distinct_blocked_ips ?? raw.ip_blocked_count),
    queueHealth: "Stable",
    totalTickets: asNumber(raw.total_incidents ?? raw.total_reviewed),
  };
  metrics.queueHealth = queueHealthFromMetrics(metrics);
  return metrics;
}

export function normalizeBackendPerIpBreakdown(rawValue: unknown): PerIpBreakdown[] {
  const raw = asRecord(rawValue);
  const items = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(raw.attackers)
      ? raw.attackers
      : [];

  return items.map((item) => {
    const row = asRecord(item);
    return {
      source_ip: asString(row.source_ip, "unknown"),
      total_hits: asNumber(row.total_hits),
      ongoing: asNumber(row.ongoing),
      contained: asNumber(row.contained),
      dismissed: asNumber(row.dismissed),
      max_confidence: asNumber(row.max_confidence),
      severity: asString(row.severity, "unknown"),
      first_seen: asString(row.first_seen),
      last_seen: asString(row.last_seen),
      reasons: asString(row.reasons),
      ip_blocked: asBoolean(row.ip_blocked),
    };
  });
}

export async function getDashboardMetricsFromBackend(): Promise<DashboardMetrics> {
  const data = await apiGet<unknown>("/api/dashboard/metrics");
  return normalizeBackendDashboardMetrics(data);
}

export async function getPerIpBreakdownFromBackend(
  limit = 20
): Promise<PerIpBreakdown[]> {
  const data = await apiGet<unknown>(
    `/api/dashboard/per-ip?limit=${encodeURIComponent(limit)}`
  );
  return normalizeBackendPerIpBreakdown(data);
}
