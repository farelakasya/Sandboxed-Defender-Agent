/**
 * Unified simulation launch endpoint — the single route the frontend calls.
 *
 * POST /api/testing/launch
 *   1. validate the request
 *   2. look up the vector + validate the target type
 *   3. build the AgentCommand (agent router + per-vector builder)
 *   4. mock mode  → synthesize a DetectionEvent, store it, return success
 *      external   → forward the AgentCommand to the collaborator backend
 *
 * Secrets are server-only: ATTACKER_APP_BASE_URL / ATTACKER_APP_API_KEY (or the
 * legacy TESTING_AGENT_BACKEND_URL / TESTING_AGENT_API_KEY). The browser never
 * talks to the attacker app / AWS directly — it only calls this route.
 */
import { NextResponse } from "next/server";
import {
  buildAgentCommand,
  getAgentForVector,
  getVectorById,
  targetSupportedByVector,
  newRunId,
} from "@/lib/agent-router";
import { buildMockDetectionEventFromCommand } from "@/lib/agent-command.builder";
import { addDetectionEvents } from "@/lib/detection-event-store";
import { normalizeAgentResultToDetectionEvents } from "@/lib/detection-to-ticket.adapter";
import type {
  SimulationLaunchRequest,
  SimulationLaunchResponse,
} from "@/lib/testing-launch.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function appBaseUrl(req: Request): string {
  // Prefer the configured public base URL; fall back to the request origin.
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export async function POST(req: Request) {
  let body: SimulationLaunchRequest;
  try {
    body = (await req.json()) as SimulationLaunchRequest;
  } catch {
    return NextResponse.json(
      { ok: false, status: "failed", provider: "mock", message: "invalid JSON body", error: "invalid JSON body" } satisfies SimulationLaunchResponse,
      { status: 400 }
    );
  }

  // ── validate ──────────────────────────────────────────────
  if (!body?.vector_id || !body?.target?.base_url || !body?.target?.target_type) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        provider: "mock",
        message: "missing vector_id or target (base_url + target_type required)",
        error: "validation_error",
      } satisfies SimulationLaunchResponse,
      { status: 400 }
    );
  }

  const vector = getVectorById(body.vector_id);
  if (!vector) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        provider: "mock",
        message: `unknown vector "${body.vector_id}"`,
        error: "unknown_vector",
      } satisfies SimulationLaunchResponse,
      { status: 404 }
    );
  }

  if (!targetSupportedByVector(vector, body.target)) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        provider: "mock",
        message: `target_type "${body.target.target_type}" is not supported by ${vector.name}. Supported: ${vector.target_types.join(", ")}.`,
        error: "unsupported_target",
      } satisfies SimulationLaunchResponse,
      { status: 422 }
    );
  }

  // ── build command ─────────────────────────────────────────
  const runId = newRunId();
  const command = buildAgentCommand({
    vector,
    target: body.target,
    options: body.options,
    appBaseUrl: appBaseUrl(req),
    runId,
  });

  const mode = process.env.TESTING_AGENT_MODE ?? "mock";

  // ── mock mode ─────────────────────────────────────────────
  if (mode !== "external") {
    const event = buildMockDetectionEventFromCommand(command, vector);
    addDetectionEvents([event]);
    const res: SimulationLaunchResponse = {
      ok: true,
      run_id: runId,
      status: "completed",
      provider: "mock",
      message:
        "Mock simulation completed — a detection event was generated. Watch /security/tickets.",
      command_preview: command,
      result: { events: [event] },
    };
    return NextResponse.json(res, { status: 200 });
  }

  // ── external mode ─────────────────────────────────────────
  // Prefer the newer ATTACKER_APP_* names; fall back to legacy TESTING_AGENT_*.
  const backendUrl =
    process.env.ATTACKER_APP_BASE_URL ?? process.env.TESTING_AGENT_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      {
        ok: false,
        run_id: runId,
        status: "failed",
        provider: "collaborator_api",
        message:
          "External mode is enabled but ATTACKER_APP_BASE_URL (or legacy TESTING_AGENT_BACKEND_URL) is not configured.",
        error: "backend_not_configured",
        command_preview: command,
      } satisfies SimulationLaunchResponse,
      { status: 500 }
    );
  }

  const { provider } = getAgentForVector(vector);
  const apiKey =
    process.env.ATTACKER_APP_API_KEY ?? process.env.TESTING_AGENT_API_KEY;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/launch`, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          run_id: runId,
          status: "failed",
          provider,
          message: `collaborator backend returned ${upstream.status}`,
          error: `upstream_${upstream.status}`,
          command_preview: command,
        } satisfies SimulationLaunchResponse,
        { status: 502 }
      );
    }

    // Synchronous case: backend returned findings/events immediately → store them
    // so the client sync bridge picks them up. Async case: backend returns
    // run_id/status and will POST events to callback.event_url later.
    const immediateEvents = normalizeAgentResultToDetectionEvents(data, {
      source: "external_agent",
      mode: "simulation",
      run_id: runId,
      event_type: vector.default_attack_type ?? vector.id,
      domain_hint: vector.domain === "fraud" ? "fraud" : "attack",
    });
    if (immediateEvents.length > 0) {
      addDetectionEvents(immediateEvents);
    }

    const status: SimulationLaunchResponse["status"] =
      typeof data?.status === "string"
        ? (data.status as SimulationLaunchResponse["status"])
        : immediateEvents.length > 0
        ? "completed"
        : "queued";

    return NextResponse.json(
      {
        ok: true,
        run_id: typeof data?.run_id === "string" ? data.run_id : runId,
        status,
        provider,
        message:
          immediateEvents.length > 0
            ? `Collaborator backend returned ${immediateEvents.length} event(s).`
            : "Simulation queued — waiting for detection events via callback.",
        command_preview: command,
        result: data,
      } satisfies SimulationLaunchResponse,
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        run_id: runId,
        status: "failed",
        provider,
        message: "could not reach the collaborator backend",
        error: err instanceof Error ? err.name : "fetch_failed",
        command_preview: command,
      } satisfies SimulationLaunchResponse,
      { status: 502 }
    );
  }
}
