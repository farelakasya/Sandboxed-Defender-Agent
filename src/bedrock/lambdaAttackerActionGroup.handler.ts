import {
  BedrockAgentEvent,
  BedrockAgentResponse,
  bedrockResponse,
  parseRequestBody,
  getParameter,
} from "./types";
import { listPersonas, getPersona } from "../services/persona.service";
import { listEndpoints, simulateRequest } from "../services/simulation.service";
import { seedStore } from "../services/seed.service";
import { store } from "../services/store";
import { SimulatedApiRequest } from "../contracts/simulation.schema";

/**
 * Lambda Action Group handler for the Bedrock ATTACKER Agent.
 *
 * Inspects event.apiPath + event.httpMethod, calls the matching internal
 * service, and returns a Bedrock-Agent-compatible response. In a real
 * deployment these services would call the backend API over HTTP; here they
 * run in-process against the same in-memory store for a self-contained demo.
 *
 * Everything is a SAFE SIMULATION — no real requests are sent anywhere.
 */
export async function handler(
  event: BedrockAgentEvent
): Promise<BedrockAgentResponse> {
  // Ensure personas/endpoints exist if this Lambda owns the store.
  if (store.personas.length === 0) seedStore();

  const apiPath = event.apiPath;
  const method = (event.httpMethod || "GET").toUpperCase();

  try {
    // GET /personas
    if (apiPath === "/personas" && method === "GET") {
      return bedrockResponse(event, listPersonas());
    }

    // GET /personas/{persona_name}
    if (/^\/personas\/[^/]+$/.test(apiPath) && method === "GET") {
      const personaName =
        getParameter(event, "persona_name") ??
        decodeURIComponent(apiPath.split("/").pop() || "");
      const persona = getPersona(personaName);
      if (!persona) {
        return bedrockResponse(event, { error: "Persona not found" }, 404);
      }
      return bedrockResponse(event, persona);
    }

    // GET /simulation-endpoints
    if (apiPath === "/simulation-endpoints" && method === "GET") {
      return bedrockResponse(event, listEndpoints());
    }

    // POST /simulate-api-request
    if (apiPath === "/simulate-api-request" && method === "POST") {
      const body = parseRequestBody<SimulatedApiRequest>(event);
      const result = simulateRequest(body);
      return bedrockResponse(event, result);
    }

    return bedrockResponse(
      event,
      { error: `Unhandled route ${method} ${apiPath}` },
      404
    );
  } catch (err) {
    return bedrockResponse(
      event,
      { error: "Action failed", detail: String(err) },
      400
    );
  }
}
