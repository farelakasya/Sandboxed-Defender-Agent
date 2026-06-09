import { AttackerPersona } from "../contracts/agent.schema";
import { SimulationEndpoint } from "../contracts/simulation.schema";
import { LogEvent } from "../contracts/log.schema";
import { Incident, DefenderActionRecord } from "../contracts/incident.schema";

/**
 * In-memory data store for the MVP. No database — everything lives in these
 * arrays for the lifetime of the process. Services mutate these directly.
 */
export const store = {
  personas: [] as AttackerPersona[],
  endpoints: [] as SimulationEndpoint[],
  logs: [] as LogEvent[],
  incidents: [] as Incident[],
  defenderActions: [] as DefenderActionRecord[],
};

let counter = 0;

/** Monotonic id helper for logs/incidents/actions. */
export function nextId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${counter}-${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
