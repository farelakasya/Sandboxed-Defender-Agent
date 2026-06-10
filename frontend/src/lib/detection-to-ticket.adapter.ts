/**
 * Detection adapters.
 *
 *  - normalizeAgentResultToDetectionEvents(result, context): coerce ANY
 *    collaborator/agent payload shape into DetectionEvent[].
 *  - normalizeDetectionEventToTicket(event): produce a unified SecurityTicket via
 *    the existing detection pipeline (classify → analyze → createDetectionTicket).
 *
 * The ticket conversion intentionally delegates to the shared pipeline so the
 * mapping stays single-sourced and tickets render in the existing UI unchanged.
 */
import type {
  DetectionEvent,
  DetectionType,
  EvidenceItem,
} from "./detectionEvent.types";
import type { SecurityTicket } from "./ticket.types";
import {
  analyzeDetectionEvent,
  classifyDetectionEvent,
  createDetectionTicket,
} from "./detection-pipeline";

export interface AgentResultContext {
  /** Vector id / event_type fallback when a finding doesn't specify one. */
  event_type?: string;
  domain_hint?: DetectionType;
  source?: DetectionEvent["source"];
  mode?: DetectionEvent["mode"];
  run_id?: string;
  target?: Partial<DetectionEvent["target"]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

const DETECTION_TYPES: DetectionType[] = [
  "normal",
  "anomaly",
  "attack",
  "fraud",
];

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Coerce a single raw evidence entry into an EvidenceItem. Accepts our native
 * shape ({timestamp,type,summary}) and the collaborator's loose shape
 * ({message, status_code, ...}).
 */
function coerceEvidence(raw: unknown, fallbackTs: string): EvidenceItem {
  if (!isObj(raw)) {
    return { timestamp: fallbackTs, type: "observation", summary: String(raw) };
  }
  const summary =
    asString(raw.summary) ??
    asString(raw.message) ??
    asString(raw.reason) ??
    "Agent evidence";
  const type = ((): EvidenceItem["type"] => {
    const t = asString(raw.type);
    if (
      t === "log" ||
      t === "observation" ||
      t === "request" ||
      t === "transaction" ||
      t === "export" ||
      t === "other"
    )
      return t;
    return "observation";
  })();
  // Preserve loose fields (status_code etc.) in details.
  const { summary: _s, message: _m, type: _t, timestamp: _ts, ...rest } = raw;
  void _s;
  void _m;
  void _t;
  void _ts;
  return {
    timestamp: asString(raw.timestamp) ?? fallbackTs,
    type,
    summary,
    details: Object.keys(rest).length ? rest : undefined,
  };
}

/** Coerce a single raw event-ish object into a DetectionEvent. */
function coerceEvent(raw: unknown, ctx: AgentResultContext): DetectionEvent {
  const ts = nowIso();
  if (!isObj(raw)) {
    return {
      event_id: uid("EVT"),
      created_at: ts,
      source: ctx.source ?? "external_agent",
      mode: ctx.mode ?? "simulation",
      event_type: ctx.event_type ?? "unknown",
      domain_hint: ctx.domain_hint,
      actor: {},
      target: { ...ctx.target },
      evidence: [],
      raw,
    };
  }

  const actor = isObj(raw.actor) ? raw.actor : {};
  const target = isObj(raw.target) ? raw.target : {};
  const rawEvidence = Array.isArray(raw.evidence) ? raw.evidence : [];

  const domainHint = ((): DetectionType | undefined => {
    const h = asString(raw.domain_hint);
    return h && DETECTION_TYPES.includes(h as DetectionType)
      ? (h as DetectionType)
      : ctx.domain_hint;
  })();

  return {
    event_id: asString(raw.event_id) ?? uid("EVT"),
    created_at: asString(raw.created_at) ?? ts,
    source: (asString(raw.source) as DetectionEvent["source"]) ??
      ctx.source ??
      "external_agent",
    mode: (asString(raw.mode) as DetectionEvent["mode"]) ?? ctx.mode ?? "simulation",
    event_type: asString(raw.event_type) ?? ctx.event_type ?? "unknown",
    domain_hint: domainHint,
    actor: {
      user_id: asString(actor.user_id),
      actor_name: asString(actor.actor_name),
      actor_role: asString(actor.actor_role),
      department: asString(actor.department),
      source_ip: asString(actor.source_ip),
      user_agent: asString(actor.user_agent),
      device_id: asString(actor.device_id),
      location: asString(actor.location),
    },
    target: {
      endpoint: asString(target.endpoint) ?? ctx.target?.endpoint,
      resource: asString(target.resource) ?? ctx.target?.resource,
      method: asString(target.method) ?? ctx.target?.method,
      asset: asString(target.asset) ?? ctx.target?.asset,
    },
    evidence: rawEvidence.map((e) => coerceEvidence(e, ts)),
    raw,
  };
}

/**
 * normalizeAgentResultToDetectionEvents — accept any of these shapes and return
 * a flat DetectionEvent[]:
 *   1. { ok, findings: [...] }
 *   2. { events: [...] }
 *   3. { detection_events: [...] }
 *   4. DetectionEvent[]
 *   5. a single event object
 */
export function normalizeAgentResultToDetectionEvents(
  result: unknown,
  ctx: AgentResultContext = {}
): DetectionEvent[] {
  if (result == null) return [];

  // Bare array → list of events.
  if (Array.isArray(result)) {
    return result.map((e) => coerceEvent(e, ctx));
  }

  if (isObj(result)) {
    const arr =
      (Array.isArray(result.detection_events) && result.detection_events) ||
      (Array.isArray(result.events) && result.events) ||
      (Array.isArray(result.findings) && result.findings) ||
      null;
    if (arr) return arr.map((e) => coerceEvent(e, ctx));

    // Looks like a single event (has event_type or evidence).
    if ("event_type" in result || "evidence" in result || "actor" in result) {
      return [coerceEvent(result, ctx)];
    }
  }

  return [];
}

/**
 * normalizeDetectionEventToTicket — full SecurityTicket from a DetectionEvent,
 * via the shared pipeline. Returned ticket carries the unified detection fields
 * (classification, mitigation_actions, developer_notification, recommended_fixes,
 * analyzer_summary, containment_status, detection_mode).
 */
export function normalizeDetectionEventToTicket(
  event: DetectionEvent
): SecurityTicket {
  const classification = classifyDetectionEvent(event);
  const analysis = analyzeDetectionEvent(event, classification);
  return createDetectionTicket(event, classification, analysis);
}
