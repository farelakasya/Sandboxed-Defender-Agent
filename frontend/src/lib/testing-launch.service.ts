/**
 * Client-side launch service. Calls ONLY our own proxy route
 * (POST /api/testing/launch) — never the collaborator backend / AWS directly.
 */
import type {
  SimulationLaunchRequest,
  SimulationLaunchResponse,
} from "./testing-launch.types";

export async function launchSimulation(
  payload: SimulationLaunchRequest
): Promise<SimulationLaunchResponse> {
  try {
    const res = await fetch("/api/testing/launch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    // The route always returns a SimulationLaunchResponse-shaped JSON.
    return (await res.json()) as SimulationLaunchResponse;
  } catch (err) {
    return {
      ok: false,
      status: "failed",
      provider: "mock",
      message: "could not reach the launch API",
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}
