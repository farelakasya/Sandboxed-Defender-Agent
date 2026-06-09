import {
  BedrockAgentEvent,
  BedrockAgentResponse,
  bedrockResponse,
  parseRequestBody,
} from "./types";
import { recentLogs, getLogById } from "../services/logNormalizer.service";
import { classifyLog } from "../services/classifierFallback.service";
import { createIncident } from "../services/incident.service";
import {
  executeDefenderAction,
  getDefenderState,
  ExecuteActionRequest,
} from "../services/defender.service";
import { LogEvent, LogEventSchema } from "../contracts/log.schema";
import { CreateIncidentRequest } from "../contracts/incident.schema";

/**
 * Lambda Action Group handler for the Bedrock DEFENDER Agent.
 *
 * Inspects event.apiPath + event.httpMethod, calls the matching internal
 * service, and returns a Bedrock-Agent-compatible response. All defender
 * actions are SAFE SIMULATIONS — no real firewall, email, or account changes.
 */
export async function handler(
  event: BedrockAgentEvent
): Promise<BedrockAgentResponse> {
  const apiPath = event.apiPath;
  const method = (event.httpMethod || "GET").toUpperCase();

  try {
    // GET /recent-logs
    if (apiPath === "/recent-logs" && method === "GET") {
      return bedrockResponse(event, recentLogs(50));
    }

    // POST /classify-log
    if (apiPath === "/classify-log" && method === "POST") {
      const body = parseRequestBody<{ log_id?: string; log?: unknown }>(event);
      let log: LogEvent | undefined;
      if (body.log_id) {
        log = getLogById(body.log_id);
        if (!log) return bedrockResponse(event, { error: "Log not found" }, 404);
      } else if (body.log) {
        log = LogEventSchema.parse(body.log);
      } else {
        return bedrockResponse(event, { error: "Provide log_id or log" }, 400);
      }
      return bedrockResponse(event, classifyLog(log));
    }

    // POST /create-incident
    if (apiPath === "/create-incident" && method === "POST") {
      const body = parseRequestBody<CreateIncidentRequest>(event);
      return bedrockResponse(event, createIncident(body), 201);
    }

    // POST /execute-defender-action
    if (apiPath === "/execute-defender-action" && method === "POST") {
      const body = parseRequestBody<ExecuteActionRequest>(event);
      return bedrockResponse(event, executeDefenderAction(body), 201);
    }

    // GET /defender-state
    if (apiPath === "/defender-state" && method === "GET") {
      return bedrockResponse(event, getDefenderState());
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
