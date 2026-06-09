import { z } from "zod";
import { LogEvent } from "../contracts/log.schema";
import {
  DefenderActionType,
  DefenderActionTypeSchema,
  Classification,
} from "../contracts/classifier.schema";
import {
  Incident,
  DefenderActionRecord,
  DefenderActionRecordSchema,
} from "../contracts/incident.schema";
import { store, nextId, nowIso } from "./store";
import { recentLogs } from "./logNormalizer.service";
import { classifyLog } from "./classifierFallback.service";
import { shouldCreateIncident } from "../utils/severityRules";
import {
  createIncident,
  attachActionToIncident,
} from "./incident.service";

/**
 * Defender service: executes SAFE, SIMULATED defender actions and exposes the
 * defender's current state. Nothing here touches real infrastructure — every
 * action is recorded as a dummy record with simulated: true.
 */

export const ExecuteActionRequestSchema = z.object({
  action_type: DefenderActionTypeSchema,
  target: z.string(),
  incident_id: z.string().optional(),
  note: z.string().optional(),
});
export type ExecuteActionRequest = z.infer<typeof ExecuteActionRequestSchema>;

const ACTION_NOTES: Record<DefenderActionType, string> = {
  block_ip: "Simulated: IP added to dummy blocklist. No real firewall change.",
  rate_limit_ip: "Simulated: IP throttled in dummy rate-limit table.",
  notify_admin: "Simulated: admin notification queued. No real email sent.",
  flag_user: "Simulated: user flagged for review in dummy state.",
  none: "Simulated: no action required.",
};

export function executeDefenderAction(
  req: ExecuteActionRequest
): DefenderActionRecord {
  const parsed = ExecuteActionRequestSchema.parse(req);
  const action: DefenderActionRecord = DefenderActionRecordSchema.parse({
    action_id: nextId("act"),
    action_type: parsed.action_type,
    target: parsed.target,
    executed_at: nowIso(),
    simulated: true,
    note: parsed.note ?? ACTION_NOTES[parsed.action_type],
  });
  store.defenderActions.push(action);
  if (parsed.incident_id) {
    attachActionToIncident(parsed.incident_id, action);
  }
  return action;
}

export interface DefenderState {
  total_logs: number;
  total_incidents: number;
  open_incidents: number;
  blocked_ips: string[];
  rate_limited_ips: string[];
  flagged_users: string[];
  admin_notifications: number;
  actions_taken: DefenderActionRecord[];
}

export function getDefenderState(): DefenderState {
  const blocked_ips = new Set<string>();
  const rate_limited_ips = new Set<string>();
  const flagged_users = new Set<string>();
  let admin_notifications = 0;

  for (const a of store.defenderActions) {
    switch (a.action_type) {
      case "block_ip":
        blocked_ips.add(a.target);
        break;
      case "rate_limit_ip":
        rate_limited_ips.add(a.target);
        break;
      case "flag_user":
        flagged_users.add(a.target);
        break;
      case "notify_admin":
        admin_notifications += 1;
        break;
      default:
        break;
    }
  }

  return {
    total_logs: store.logs.length,
    total_incidents: store.incidents.length,
    open_incidents: store.incidents.filter((i) => i.status === "open").length,
    blocked_ips: [...blocked_ips],
    rate_limited_ips: [...rate_limited_ips],
    flagged_users: [...flagged_users],
    admin_notifications,
    actions_taken: store.defenderActions,
  };
}

export interface AnalyzedLog {
  log: LogEvent;
  classification: Classification;
  incident_id: string | null;
}

export interface AnalyzeRecentResult {
  analyzed_count: number;
  created_incidents: Incident[];
  recommended_actions: {
    incident_id: string;
    action_type: DefenderActionType;
    target: string;
  }[];
  details: AnalyzedLog[];
}

/**
 * Deterministic blue-team pass: read recent logs, classify each, and open an
 * incident for every MEDIUM/HIGH/CRITICAL finding. Returns the created
 * incidents and the dummy actions they recommend. Does NOT auto-execute
 * actions — that is left to the Defender Agent or an explicit /action call.
 */
export function analyzeRecent(limit = 50): AnalyzeRecentResult {
  const logs = recentLogs(limit);
  const created_incidents: Incident[] = [];
  const recommended_actions: AnalyzeRecentResult["recommended_actions"] = [];
  const details: AnalyzedLog[] = [];

  // recentLogs returns newest-first; process oldest-first for a natural timeline.
  for (const log of [...logs].reverse()) {
    const classification = classifyLog(log);
    let incident_id: string | null = null;

    if (shouldCreateIncident(classification.severity)) {
      const incident = createIncident({
        threat_type: classification.threat_type,
        severity: classification.severity,
        persona_name: log.persona_name ?? null,
        log_ids: [log.log_id],
        recommended_action: classification.recommended_action,
        summary: classification.rationale,
      });
      created_incidents.push(incident);
      incident_id = incident.id;
      if (classification.recommended_action !== "none") {
        recommended_actions.push({
          incident_id: incident.id,
          action_type: classification.recommended_action,
          target: targetForAction(classification.recommended_action, log),
        });
      }
    }

    details.push({ log, classification, incident_id });
  }

  return {
    analyzed_count: logs.length,
    created_incidents,
    recommended_actions,
    details,
  };
}

function targetForAction(action: DefenderActionType, log: LogEvent): string {
  switch (action) {
    case "block_ip":
    case "rate_limit_ip":
      return log.ip ?? "unknown-ip";
    case "flag_user":
      return log.user_id ?? "unknown-user";
    case "notify_admin":
      return "security-admin";
    default:
      return "n/a";
  }
}
