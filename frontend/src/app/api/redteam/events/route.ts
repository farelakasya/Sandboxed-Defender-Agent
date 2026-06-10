import { NextResponse } from "next/server";
import {
  clearRedTeamEvents,
  getRedTeamEvents,
} from "@/lib/redteam-event-store";

/**
 * GET    /api/redteam/events  → all classified red-team events (for client sync)
 * DELETE /api/redteam/events  → clear the in-memory event store (demo reset)
 *
 * SAFE SIMULATION: events are produced by the controlled /api/redteam/attack and
 * /api/sim-target/* routes. Nothing here touches real systems.
 */

// In-memory store mutates per request; never cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const events = getRedTeamEvents();
  return NextResponse.json({ ok: true, simulated: true, events });
}

export async function DELETE() {
  const cleared = clearRedTeamEvents();
  return NextResponse.json({ ok: true, simulated: true, cleared });
}
