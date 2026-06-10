"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useTicketStore } from "@/stores/ticket.store";
import type { SimulationIncidentEvent } from "@/lib/redteam.types";

/**
 * Client-side red-team event sync bridge.
 *
 * API route handlers store red-team events server-side but CANNOT write to the
 * browser-localStorage ticket store. This component polls GET /api/redteam/events
 * and imports any events it hasn't seen into the Zustand ticket store, so the
 * dashboard / queue / detail pages update automatically while the app is open.
 *
 * - Imported event ids are remembered in localStorage to avoid re-imports
 *   across reloads.
 * - Failures are swallowed (the app must not crash if the API is down).
 *
 * Mounted once in the root layout. Renders nothing.
 */

const POLL_MS = 4000;
const SEEN_KEY = "sandboxed-defender:redteam-seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Cap stored ids so the key can't grow unbounded.
    const arr = [...seen].slice(-1000);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // ignore quota / serialization errors
  }
}

export function RedTeamEventSync() {
  const { toast } = useToast();
  const importEvents = useTicketStore((s) => s.importRedTeamEvents);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = loadSeen();
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/redteam/events", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const events: SimulationIncidentEvent[] = Array.isArray(data.events)
          ? data.events
          : [];

        const fresh = events.filter((e) => !seenRef.current.has(e.event_id));
        if (fresh.length === 0) return;

        const { createdCount } = importEvents(fresh);
        for (const e of fresh) seenRef.current.add(e.event_id);
        saveSeen(seenRef.current);

        if (createdCount > 0) {
          toast({
            variant: "alert",
            title: "New red-team attack ticket created",
            description:
              createdCount === 1
                ? "1 ticket synced from the red-team simulation."
                : `${createdCount} tickets synced from the red-team simulation.`,
          });
        }
      } catch {
        // Network error — silently retry on the next tick.
      }
    }

    // Prime once immediately, then on an interval.
    void poll();
    const id = window.setInterval(() => {
      if (!cancelled) void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [importEvents, toast]);

  return null;
}
