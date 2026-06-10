"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useTicketStore } from "@/stores/ticket.store";
import type { DetectionEvent } from "@/lib/detectionEvent.types";

/**
 * Client-side detection event sync bridge.
 *
 * The launch route and the collaborator callback store DetectionEvents
 * server-side (in-memory). Route handlers can't write to the browser-localStorage
 * ticket store, so this component polls GET /api/detection/events and imports any
 * unseen events into the Zustand ticket store — updating dashboard / queue /
 * detail automatically while the app is open.
 *
 * Seen ids are remembered in localStorage to avoid re-imports across reloads.
 * Failures are swallowed (the app must not crash if the API is down).
 *
 * Mounted once in the root layout. Renders nothing.
 */

const POLL_MS = 4000;
const SEEN_KEY = "sandboxed-defender:detection-seen";

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
    const arr = [...seen].slice(-1000);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // ignore quota / serialization errors
  }
}

export function DetectionEventSync() {
  const { toast } = useToast();
  const importEvents = useTicketStore((s) => s.importDetectionEvents);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = loadSeen();
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/detection/events", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const events: DetectionEvent[] = Array.isArray(data.events)
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
            title: "New detection ticket created",
            description:
              createdCount === 1
                ? "1 detection ticket synced from the simulation pipeline."
                : `${createdCount} detection tickets synced from the simulation pipeline.`,
          });
        }
      } catch {
        // Network error — silently retry on the next tick.
      }
    }

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
