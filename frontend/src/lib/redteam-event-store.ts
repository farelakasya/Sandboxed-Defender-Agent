import type { SimulationIncidentEvent } from "./redteam.types";

/**
 * In-memory red-team event store (server-side).
 *
 * API route handlers store classified SimulationIncidentEvents here. The client
 * cannot write to the browser-localStorage ticket store from a route handler, so
 * the client polls GET /api/redteam/events and imports new events itself (see
 * components/redteam/RedTeamEventSync.tsx).
 *
 * Persisted on globalThis so the single instance survives Next.js dev HMR /
 * module re-evaluation across route handlers.
 *
 * TODO(production): replace this in-memory store with a database or durable
 * queue (e.g. DynamoDB / SQS). It is intentionally ephemeral for the hackathon
 * MVP — events are lost on server restart, and it is not multi-instance safe.
 */

const MAX_EVENTS = 500;

type Store = { events: SimulationIncidentEvent[] };

const globalStore = globalThis as unknown as {
  __redteamEventStore__?: Store;
};

function store(): Store {
  if (!globalStore.__redteamEventStore__) {
    globalStore.__redteamEventStore__ = { events: [] };
  }
  return globalStore.__redteamEventStore__;
}

/** Append an event (newest last). Caps total size to MAX_EVENTS. */
export function addRedTeamEvent(
  event: SimulationIncidentEvent
): SimulationIncidentEvent {
  const s = store();
  s.events.push(event);
  if (s.events.length > MAX_EVENTS) {
    s.events = s.events.slice(-MAX_EVENTS);
  }
  return event;
}

/** All events, oldest → newest (stable order for client dedup by id). */
export function getRedTeamEvents(): SimulationIncidentEvent[] {
  return [...store().events];
}

export function getRedTeamEventById(
  eventId: string
): SimulationIncidentEvent | null {
  return store().events.find((e) => e.event_id === eventId) ?? null;
}

/** Wipe all events. Returns how many were removed. */
export function clearRedTeamEvents(): number {
  const s = store();
  const n = s.events.length;
  s.events = [];
  return n;
}
