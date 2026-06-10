import { NextResponse } from "next/server";
import { validateAttackRequest } from "@/lib/redteam-validate";
import { classifyAttackRequest } from "@/lib/redteam-classifier";
import { addRedTeamEvent } from "@/lib/redteam-event-store";
import type { RedTeamAttackResponse } from "@/lib/redteam.types";

/**
 * POST /api/redteam/attack
 *
 * The Bedrock red-team attacker agent posts a SimulationAttackRequest here. The
 * route validates it, classifies it into a SimulationIncidentEvent, stores it in
 * the in-memory event store, and echoes the event + suggested defender action.
 *
 * SAFE SIMULATION: this never performs real exploitation, blocking, or auth. The
 * "defender action" is a label describing what a real system would do.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, simulated: true, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = validateAttackRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, simulated: true, errors: parsed.errors },
      { status: 422 }
    );
  }

  const event = classifyAttackRequest(parsed.value);
  addRedTeamEvent(event);

  const response: RedTeamAttackResponse = {
    ok: true,
    simulated: true,
    event,
    message: "Red-team attack event received",
  };
  return NextResponse.json(response, { status: 201 });
}
