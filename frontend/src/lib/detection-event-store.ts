import type { DetectionEvent } from "./detectionEvent.types";

/**
 * In-memory detection event store (server-side).
 *
 * The launch route (mock mode) and the /api/detection/events callback write
 * DetectionEvents here. The browser-localStorage ticket store can't be mutated
 * from a route handler, so the client polls GET /api/detection/events and
 * imports new events itself (see components/detection/DetectionEventSync.tsx).
 *
 * Persisted on globalThis so the single instance survives Next.js dev HMR /
 * module re-evaluation across route handlers.
 *
 * TODO(production): replace with a database or durable queue. Ephemeral for the
 * hackathon MVP — events are lost on restart and it is not multi-instance safe.
 */

const MAX_EVENTS = 500;

type Store = { events: DetectionEvent[] };

const globalStore = globalThis as unknown as {
  __detectionEventStore__?: Store;
};

function store(): Store {
  if (!globalStore.__detectionEventStore__) {
    globalStore.__detectionEventStore__ = { events: [] };
  }
  return globalStore.__detectionEventStore__;
}

/** Append events (newest last), de-duplicating by event_id. Caps to MAX_EVENTS. */
export function addDetectionEvents(events: DetectionEvent[]): DetectionEvent[] {
  const s = store();
  const known = new Set(s.events.map((e) => e.event_id));
  const fresh = events.filter((e) => !known.has(e.event_id));
  s.events.push(...fresh);
  if (s.events.length > MAX_EVENTS) {
    s.events = s.events.slice(-MAX_EVENTS);
  }
  return fresh;
}

/** All events, oldest → newest (stable order for client dedup by id). */
export function getDetectionEvents(): DetectionEvent[] {
  return [...store().events];
}

export function getDetectionEventById(eventId: string): DetectionEvent | null {
  return store().events.find((e) => e.event_id === eventId) ?? null;
}

/** Wipe all events. Returns how many were removed. */
export function clearDetectionEvents(): number {
  const s = store();
  const n = s.events.length;
  s.events = [];
  return n;
}
