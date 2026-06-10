/**
 * STUB seam for DB-wide dashboard aggregates from the defender backend.
 *
 * Today the dashboard's distribution/timeline widgets derive their numbers from
 * only the loaded sample of tickets. These functions consume the (not-yet-built)
 * backend aggregate endpoints so the widgets reflect the FULL verdict DB:
 *
 *   GET /api/dashboard/distributions  → severity/attack-type/detection-label/
 *                                        defender-action/endpoint/fix counts
 *   GET /api/dashboard/timeline?limit  → recent defender activity across all tickets
 *
 * Safe-by-design: each fetch is independent and returns `null` on any failure
 * (404 while the backend agent is still building it, network error, bad JSON,
 * unexpected shape). Callers fall back to the existing client-side derivation.
 * Field names are read defensively so minor backend naming differences degrade
 * to a fallback rather than crash. Does NOT touch the working /metrics or
 * /per-ip endpoints.
 *
 * When the backend ships these endpoints with matching shapes, the dashboard
 * starts using real DB-wide data automatically — no redeploy of new logic.
 */
import { apiGet } from "./api-client";
import type {
  AttackTypeCount,
  DefenseSummaryItem,
  DefenseFeedItem,
  DetectionTypeSummary,
  DetectionTypeCount,
  EndpointCount,
  FixSummary,
  SeveritySlice,
} from "./dashboard.utils";
import type { Severity } from "./ticket.types";
import type { DefenderAction } from "./ticket.types";
import type { DetectionType } from "./detectionEvent.types";

// ---------------------------------------------------------------------------
// tiny defensive readers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
/** Read the first present key from a record (defensive against naming drift). */
function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined) return raw[k];
  }
  return undefined;
}

const VALID_SEVERITY = new Set<Severity>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_DEFENDER_ACTION = new Set<DefenderAction>([
  "block_ip",
  "rate_limit_ip",
  "flag_user",
  "notify_admin",
  "notify_dev",
  "disable_account",
  "suspend_export",
  "none",
]);
const VALID_DETECTION_TYPE = new Set<DetectionType>([
  "normal",
  "anomaly",
  "attack",
  "fraud",
]);

// ---------------------------------------------------------------------------
// public aggregate shape (what the dashboard consumes)
// ---------------------------------------------------------------------------

export type DashboardDistributions = {
  bySeverity: SeveritySlice[];
  byAttackType: AttackTypeCount[];
  detectionTypes: DetectionTypeSummary;
  defense: DefenseSummaryItem[];
  topEndpoints: EndpointCount[];
  fixes: FixSummary[];
};

const DEFENSE_LABELS: Record<DefenderAction, string> = {
  block_ip: "IP Blocked",
  rate_limit_ip: "Rate Limited",
  flag_user: "Users Flagged",
  disable_account: "Accounts Disabled",
  suspend_export: "Exports Suspended",
  notify_admin: "Admin Notified",
  notify_dev: "Dev Notified",
  none: "No Action",
};

// ---------------------------------------------------------------------------
// normalizers (one per dimension; each tolerant of empty/missing input)
// ---------------------------------------------------------------------------

function normalizeSeverity(items: unknown[]): SeveritySlice[] {
  const out: SeveritySlice[] = [];
  for (const item of items) {
    const raw = asRecord(item);
    const sev = asString(pick(raw, "severity", "label", "name")).toUpperCase();
    if (VALID_SEVERITY.has(sev as Severity)) {
      out.push({
        severity: sev as Severity,
        count: asNumber(pick(raw, "count", "total", "value")),
      });
    }
  }
  return out;
}

function normalizeAttackType(items: unknown[]): AttackTypeCount[] {
  return items
    .map((item) => {
      const raw = asRecord(item);
      return {
        attack_type: asString(
          pick(raw, "attack_type", "type", "label", "name"),
          "unknown"
        ),
        count: asNumber(pick(raw, "count", "total", "value")),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function normalizeDetectionTypes(value: unknown): DetectionTypeSummary {
  const raw = asRecord(value);
  const list = asArray(pick(raw, "by_detection_label", "labels", "items") ?? value);
  const byType: DetectionTypeCount[] = [];
  for (const item of list) {
    const r = asRecord(item);
    const t = asString(pick(r, "label", "type", "name")).toLowerCase();
    if (VALID_DETECTION_TYPE.has(t as DetectionType)) {
      byType.push({
        type: t as DetectionType,
        count: asNumber(pick(r, "count", "total", "value")),
      });
    }
  }
  return {
    byType,
    multiLabel: asNumber(pick(raw, "multi_label", "multiLabel")),
    classified: asNumber(
      pick(raw, "classified", "total_classified"),
      byType.reduce((s, b) => s + b.count, 0)
    ),
  };
}

function normalizeDefense(items: unknown[]): DefenseSummaryItem[] {
  return items
    .map((item) => {
      const raw = asRecord(item);
      const action = asString(
        pick(raw, "action", "defender_action"),
        "none"
      ).toLowerCase() as DefenderAction;
      const safeAction: DefenderAction = VALID_DEFENDER_ACTION.has(action)
        ? action
        : "none";
      return {
        action: safeAction,
        label: DEFENSE_LABELS[safeAction],
        count: asNumber(pick(raw, "count", "total", "value")),
      };
    })
    .filter((d) => d.count > 0);
}

function normalizeEndpoints(items: unknown[]): EndpointCount[] {
  return items
    .map((item) => {
      const raw = asRecord(item);
      return {
        endpoint: asString(
          pick(raw, "endpoint", "affected_endpoint", "path"),
          "/"
        ),
        attempts: asNumber(pick(raw, "count", "attempts", "total", "value")),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);
}

function normalizeFixes(items: unknown[]): FixSummary[] {
  return items.map((item) => {
    const raw = asRecord(item);
    const priority = asString(pick(raw, "priority"), "MEDIUM").toUpperCase();
    return {
      title: asString(pick(raw, "title", "name"), "Recommended fix"),
      category: asString(
        pick(raw, "category"),
        "Monitoring"
      ) as FixSummary["category"],
      priority:
        priority === "HIGH" || priority === "LOW"
          ? (priority as FixSummary["priority"])
          : "MEDIUM",
      ticketsAffected: asNumber(
        pick(raw, "count", "tickets_affected", "ticketsAffected")
      ),
      exampleEndpoint: asString(
        pick(raw, "example_endpoint", "exampleEndpoint", "endpoint"),
        ""
      ),
      suggestedFix: asString(pick(raw, "suggested_fix", "suggestedFix"), ""),
    };
  });
}

// ---------------------------------------------------------------------------
// fetchers — return null on ANY failure so callers fall back cleanly
// ---------------------------------------------------------------------------

/**
 * DB-wide distributions. Returns null if the endpoint is missing/unreachable or
 * the payload doesn't contain at least one recognizable dimension (so the
 * dashboard keeps its current client-side derivation).
 */
export async function getDashboardDistributionsFromBackend(): Promise<DashboardDistributions | null> {
  try {
    const data = await apiGet<unknown>("/api/dashboard/distributions");
    const raw = asRecord(data);

    const bySeverity = normalizeSeverity(
      asArray(pick(raw, "by_severity", "severity", "bySeverity"))
    );
    const byAttackType = normalizeAttackType(
      asArray(pick(raw, "by_attack_type", "attack_types", "byAttackType"))
    );
    const detectionTypes = normalizeDetectionTypes(
      pick(raw, "by_detection_label", "detection_types", "detectionTypes") ?? raw
    );
    const defense = normalizeDefense(
      asArray(pick(raw, "by_defender_action", "defense", "actions"))
    );
    const topEndpoints = normalizeEndpoints(
      asArray(pick(raw, "by_endpoint", "top_endpoints", "endpoints"))
    );
    const fixes = normalizeFixes(
      asArray(pick(raw, "top_recommended_fixes", "fixes", "recommended_fixes"))
    );

    // If nothing recognizable came back, treat as "not available" → fallback.
    const anyData =
      bySeverity.length > 0 ||
      byAttackType.length > 0 ||
      detectionTypes.byType.length > 0 ||
      defense.length > 0 ||
      topEndpoints.length > 0 ||
      fixes.length > 0;
    if (!anyData) return null;

    return {
      bySeverity,
      byAttackType,
      detectionTypes,
      defense,
      topEndpoints,
      fixes,
    };
  } catch {
    return null;
  }
}

/**
 * Recent defender activity across ALL tickets. Returns null on failure so the
 * dashboard falls back to deriving the timeline from loaded tickets.
 */
export async function getDashboardTimelineFromBackend(
  limit = 8
): Promise<DefenseFeedItem[] | null> {
  try {
    const data = await apiGet<unknown>(
      `/api/dashboard/timeline?limit=${encodeURIComponent(limit)}`
    );
    const raw = asRecord(data);
    const items = asArray(Array.isArray(data) ? data : pick(raw, "events", "items"));
    if (items.length === 0) return null;

    return items.map((item, i) => {
      const r = asRecord(item);
      return {
        id: asString(pick(r, "id"), `tl-${i}`),
        ticket_id: asString(pick(r, "ticket_id", "ticketId"), ""),
        ticket_title: asString(
          pick(r, "ticket_title", "title", "description", "event"),
          "Defender activity"
        ),
        actor: asString(pick(r, "actor", "detected_by"), "AI Defender"),
        message: asString(
          pick(r, "description", "message", "event"),
          "Defender activity recorded."
        ),
        timestamp: asString(pick(r, "timestamp", "created_at"), new Date().toISOString()),
      };
    });
  } catch {
    return null;
  }
}
