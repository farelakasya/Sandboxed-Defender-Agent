import {
  Incident,
  IncidentSchema,
  CreateIncidentRequest,
  CreateIncidentRequestSchema,
  IncidentStatus,
  DefenderActionRecord,
} from "../contracts/incident.schema";
import { store, nextId, nowIso } from "./store";

/**
 * Incident lifecycle service. Incidents are created by the Defender Agent (or
 * the deterministic analyze-recent route) for MEDIUM/HIGH/CRITICAL findings.
 */

export function createIncident(req: CreateIncidentRequest): Incident {
  const parsed = CreateIncidentRequestSchema.parse(req);
  const ts = nowIso();
  const incident: Incident = IncidentSchema.parse({
    id: nextId("inc"),
    created_at: ts,
    updated_at: ts,
    title: parsed.title ?? defaultTitle(parsed),
    threat_type: parsed.threat_type,
    severity: parsed.severity,
    status: "open" as IncidentStatus,
    persona_name: parsed.persona_name ?? null,
    log_ids: parsed.log_ids,
    recommended_action: parsed.recommended_action,
    actions_taken: [],
    summary:
      parsed.summary ??
      `${parsed.severity} ${parsed.threat_type} incident. Recommended action: ${parsed.recommended_action}.`,
  });
  store.incidents.push(incident);
  return incident;
}

function defaultTitle(req: CreateIncidentRequest): string {
  const persona = req.persona_name ? ` (${req.persona_name})` : "";
  return `${req.severity}: ${req.threat_type.replace(/_/g, " ")}${persona}`;
}

export function listIncidents(): Incident[] {
  return [...store.incidents].reverse();
}

export function getIncident(id: string): Incident | undefined {
  return store.incidents.find((i) => i.id === id);
}

export function updateIncidentStatus(
  id: string,
  status: IncidentStatus
): Incident | undefined {
  const incident = getIncident(id);
  if (!incident) return undefined;
  incident.status = status;
  incident.updated_at = nowIso();
  return incident;
}

export function attachActionToIncident(
  id: string,
  action: DefenderActionRecord
): Incident | undefined {
  const incident = getIncident(id);
  if (!incident) return undefined;
  incident.actions_taken.push(action);
  incident.updated_at = nowIso();
  return incident;
}
