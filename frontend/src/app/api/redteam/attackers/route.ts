import { NextResponse } from "next/server";
import { MOCK_ATTACKERS } from "@/data/mockAttackers";

/**
 * GET /api/redteam/attackers → list of selectable attacker personas.
 *
 * Returns the built-in mock personas for now. The collaborator's Bedrock service
 * can later replace this body (or the frontend can point NEXT_PUBLIC_API_BASE_URL
 * at the remote service) without any frontend change — the response shape stays
 * { attackers: AttackerPersona[] }.
 */
export async function GET() {
  return NextResponse.json({ attackers: MOCK_ATTACKERS });
}
