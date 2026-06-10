import type { AttackerPersona } from "./attacker.types";
import { MOCK_ATTACKERS } from "@/data/mockAttackers";

/**
 * Attacker-persona data-access layer for the simulation setup UI.
 *
 * Behaviour (per hackathon spec):
 *  - If NEXT_PUBLIC_USE_MOCK_DATA === "true" → return mock personas directly.
 *  - Otherwise fetch GET {NEXT_PUBLIC_API_BASE_URL}/api/redteam/attackers.
 *  - On ANY failure → fall back to mock personas and console.warn. Never throw,
 *    so the page can always render.
 *
 * The API response shape is accepted flexibly: { attackers: [] } | { data: [] }
 * | [].
 */

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Accept { attackers }, { data }, or a bare array. Bad input → []. */
export function normalizeAttackerApiResponse(raw: unknown): AttackerPersona[] {
  if (Array.isArray(raw)) return raw as AttackerPersona[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.attackers)) return obj.attackers as AttackerPersona[];
    if (Array.isArray(obj.data)) return obj.data as AttackerPersona[];
  }
  return [];
}

/**
 * Load all attacker personas. Always resolves (mock fallback on error) so the
 * selector never crashes the setup page.
 */
export async function getAttackers(): Promise<AttackerPersona[]> {
  if (USE_MOCK) return MOCK_ATTACKERS;

  // Relative URL ("/api/redteam/attackers") works when API_BASE is empty,
  // hitting this app's own local route handler.
  const url = `${API_BASE}/api/redteam/attackers`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`attackers API responded ${res.status}`);
    }
    const data = normalizeAttackerApiResponse(await res.json());
    // Empty response is treated as a soft failure → use mocks so the UI works.
    return data.length > 0 ? data : MOCK_ATTACKERS;
  } catch (err) {
    console.warn(
      `[attackers.service] falling back to mock attackers: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return MOCK_ATTACKERS;
  }
}

/** Look up a single persona by id. Returns null if not found. */
export async function getAttackerById(
  id: string
): Promise<AttackerPersona | null> {
  const all = await getAttackers();
  return all.find((a) => a.id === id) ?? null;
}
