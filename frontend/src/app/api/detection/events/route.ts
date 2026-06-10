/**
 * Generic detection-event ingestion + sync endpoint.
 *
 * POST   — accept a DetectionEvent, an array, or a raw collaborator/agent
 *          payload ({events|detection_events|findings}); normalize → classify →
 *          analyze → store; return normalized events + ticket previews.
 * GET    — return recent server-side events for the client sync bridge.
 * DELETE — clear the in-memory store (demo reset).
 *
 * This is the callback URL the collaborator backend posts to (callback.event_url
 * in the AgentCommand). It runs on the Node runtime and never exposes secrets.
 */
import { NextResponse } from "next/server";
import {
  addDetectionEvents,
  clearDetectionEvents,
  getDetectionEvents,
} from "@/lib/detection-event-store";
import {
  normalizeAgentResultToDetectionEvents,
  normalizeDetectionEventToTicket,
} from "@/lib/detection-to-ticket.adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    events: getDetectionEvents(),
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  // Normalize whatever shape arrived into DetectionEvent[].
  const events = normalizeAgentResultToDetectionEvents(body, {
    source: "external_agent",
    mode: "simulation",
  });

  if (events.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no detection events found in payload" },
      { status: 422 }
    );
  }

  const stored = addDetectionEvents(events);

  // Build ticket previews (the authoritative create/update happens client-side
  // in the ticket store via DetectionEventSync; this is a server-side preview).
  const ticketPreviews = stored.map((e) => {
    const t = normalizeDetectionEventToTicket(e);
    return {
      ticket_id: t.ticket_id,
      title: t.title,
      severity: t.severity,
      classification: t.detection_classification,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      received: events.length,
      stored: stored.length,
      events: stored,
      ticket_previews: ticketPreviews,
    },
    { status: 201 }
  );
}

export async function DELETE() {
  const cleared = clearDetectionEvents();
  return NextResponse.json({ ok: true, cleared });
}
