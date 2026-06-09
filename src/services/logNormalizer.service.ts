import {
  LogEvent,
  LogEventSchema,
  RawLogIngest,
  RawLogIngestSchema,
  HttpMethod,
  Role,
} from "../contracts/log.schema";
import { store, nextId, nowIso } from "./store";

/**
 * Normalizes raw / external log records (e.g. nginx-style) into canonical
 * LogEvents and appends them to the in-memory log store.
 */

const VALID_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const VALID_ROLES: Role[] = [
  "external",
  "admin",
  "rm",
  "sales",
  "lead_gen",
  "auditor",
  "unknown",
];

function coerceMethod(value?: string): HttpMethod {
  const v = (value || "GET").toUpperCase();
  return (VALID_METHODS as string[]).includes(v) ? (v as HttpMethod) : "GET";
}

function coerceRole(value?: string): Role {
  const v = (value || "unknown").toLowerCase();
  return (VALID_ROLES as string[]).includes(v) ? (v as Role) : "unknown";
}

function coerceStatus(value?: number | string): number {
  if (typeof value === "number") return value;
  const n = parseInt(String(value ?? "200"), 10);
  return Number.isFinite(n) ? n : 200;
}

/** Build a fully-formed LogEvent from already-known fields (used by simulation). */
export function buildLogEvent(input: Omit<LogEvent, "log_id" | "timestamp" | "source"> & {
  source?: string;
  timestamp?: string;
}): LogEvent {
  return LogEventSchema.parse({
    log_id: nextId("log"),
    timestamp: input.timestamp ?? nowIso(),
    source: input.source ?? "simulation",
    ...input,
  });
}

export function normalizeRawLog(raw: RawLogIngest): LogEvent {
  const parsed = RawLogIngestSchema.parse(raw);
  const status = coerceStatus(parsed.status_code);
  const endpoint = parsed.endpoint ?? parsed.path ?? "/";
  return LogEventSchema.parse({
    log_id: nextId("log"),
    timestamp: parsed.timestamp ?? nowIso(),
    persona_name: parsed.persona_name ?? null,
    method: coerceMethod(parsed.method),
    endpoint,
    role: coerceRole(parsed.role),
    user_id: parsed.user_id ?? null,
    ip: parsed.ip ?? null,
    user_agent: parsed.user_agent ?? "unknown",
    status_code: status,
    allowed: parsed.allowed ?? status < 400,
    reason: parsed.reason ?? `Ingested log (status ${status}).`,
    source: "ingest",
  });
}

export function appendLog(log: LogEvent): LogEvent {
  store.logs.push(log);
  return log;
}

export function ingestRawLog(raw: RawLogIngest): LogEvent {
  return appendLog(normalizeRawLog(raw));
}

export function ingestRawLogBatch(raws: RawLogIngest[]): LogEvent[] {
  return raws.map((r) => ingestRawLog(r));
}

export function recentLogs(limit = 50): LogEvent[] {
  return store.logs.slice(-limit).reverse();
}

export function getLogById(logId: string): LogEvent | undefined {
  return store.logs.find((l) => l.log_id === logId);
}
