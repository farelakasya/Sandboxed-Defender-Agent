import {
  SimulationEndpoint,
  SimulationEndpointSchema,
  SimulatedApiRequest,
  SimulatedApiRequestSchema,
  SimulatedApiResponse,
  RequiredRole,
} from "../contracts/simulation.schema";
import { Role } from "../contracts/log.schema";
import { store } from "./store";
import { buildLogEvent, appendLog, recentLogs } from "./logNormalizer.service";

/**
 * Simulation service: the dummy target environment. It owns the endpoint
 * catalog and evaluates simulated attacker requests against an access-control
 * policy, producing a structured LogEvent for EVERY request.
 *
 * No real handlers run — this is purely an authorization + logging simulator.
 */

export function setEndpoints(endpoints: SimulationEndpoint[]): SimulationEndpoint[] {
  store.endpoints = endpoints.map((e) => SimulationEndpointSchema.parse(e));
  return store.endpoints;
}

export function listEndpoints(): SimulationEndpoint[] {
  return store.endpoints;
}

/**
 * Roles allowed per endpoint, beyond the single `required_role`. This encodes
 * the policy described in the spec:
 *  - admin endpoints require admin
 *  - report export requires admin or auditor
 *  - client data allows rm, sales, admin, auditor (never external)
 */
function allowedRolesFor(endpoint: SimulationEndpoint): Set<Role> {
  const path = endpoint.endpoint;

  if (/^\/api\/admin\//i.test(path)) {
    return new Set<Role>(["admin"]);
  }
  if (/^\/api\/reports\/export$/i.test(path)) {
    return new Set<Role>(["admin", "auditor"]);
  }
  if (/^\/api\/clients\//i.test(path)) {
    return new Set<Role>(["rm", "sales", "admin", "auditor"]);
  }
  if (/^\/api\/leads$/i.test(path)) {
    return new Set<Role>(["lead_gen", "sales", "admin"]);
  }
  if (/^\/api\/login$/i.test(path)) {
    // Login is open to external callers by design.
    return new Set<Role>(["external", "admin", "rm", "sales", "lead_gen", "auditor"]);
  }
  // Default: only the declared required_role.
  return new Set<Role>([endpoint.required_role as Role]);
}

/**
 * Match a request endpoint against the catalog, supporting `:param` segments
 * (e.g. catalog "/api/clients/:id" matches request "/api/clients/4821").
 */
function findEndpoint(
  method: string,
  endpoint: string
): SimulationEndpoint | undefined {
  return store.endpoints.find((e) => {
    if (e.method !== method) return false;
    return pathMatches(e.endpoint, endpoint);
  });
}

function pathMatches(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  const pParts = pattern.split("/");
  const aParts = actual.split("/");
  if (pParts.length !== aParts.length) return false;
  return pParts.every((seg, i) => seg.startsWith(":") || seg === aParts[i]);
}

export function simulateRequest(raw: SimulatedApiRequest): SimulatedApiResponse {
  const req = SimulatedApiRequestSchema.parse(raw);
  const endpoint = findEndpoint(req.method, req.endpoint);

  let status_code: number;
  let allowed: boolean;
  let reason: string;
  let sensitivity: SimulationEndpoint["sensitivity"] | null = null;

  if (!endpoint) {
    status_code = 404;
    allowed = false;
    reason = `Endpoint ${req.method} ${req.endpoint} does not exist.`;
  } else {
    sensitivity = endpoint.sensitivity;
    const allowedRoles = allowedRolesFor(endpoint);
    if (allowedRoles.has(req.role as Role)) {
      status_code = 200;
      allowed = true;
      reason = `Role "${req.role}" permitted on ${endpoint.endpoint}.`;
    } else {
      status_code = 403;
      allowed = false;
      reason = `Role "${req.role}" forbidden on ${endpoint.endpoint} (requires one of: ${[
        ...allowedRoles,
      ].join(", ")}).`;
    }
  }

  const log = appendLog(
    buildLogEvent({
      persona_name: req.persona_name,
      method: req.method,
      endpoint: req.endpoint,
      role: req.role as Role,
      user_id: req.user_id ?? null,
      ip: req.ip ?? null,
      user_agent: req.user_agent,
      status_code,
      allowed,
      reason,
      sensitivity,
    })
  );

  return {
    status_code,
    allowed,
    reason,
    log_created: true,
    log,
  };
}

export function simulationLogs(limit = 50): ReturnType<typeof recentLogs> {
  return recentLogs(limit);
}
