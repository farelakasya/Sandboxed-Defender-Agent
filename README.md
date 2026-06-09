# Sandboxed-Defender-Agent

A TypeScript + Express backend scaffold for a hackathon MVP where **AWS Bedrock**
runs both an **Attacker Agent** (red team) and a **Defender Agent** (blue team)
against a **safe, simulated** target environment.

> ⚠️ Everything here is a **safe dummy simulation**. No real hacking, no real
> firewall changes, no real emails. The backend is the dummy target + log
> generator; **the LLM agents live in Bedrock, not in this backend.**

## Stack

- Express + TypeScript
- Zod for contract validation
- CORS enabled
- In-memory arrays only (no database)

## Run

```bash
npm install
npm run dev      # ts-node-dev, hot reload on http://localhost:3000
# or
npm run build && npm start
```

Health check: `GET /health`

The store is **seeded from mocks at boot** (personas, endpoints, a seed
incident), so the API is useful immediately.

## Project layout

```
src/
  contracts/    Zod schemas + inferred types (the source of truth)
  mocks/        Seed data (personas, endpoints, logs, incidents)
  services/     Business logic over the in-memory store
  routes/       Express routers (REST + agent-tool surface)
  utils/        patternMatch + severityRules (deterministic classifier rules)
  bedrock/      OpenAPI schemas + Lambda Action Group handlers
```

## API surface

### Personas
- `POST /api/personas/import` — import MiroFish output (envelope or bare array)
- `GET  /api/personas`
- `GET  /api/personas/:persona_name`

### MiroFish helpers
- `GET  /api/mirofish/sample` — raw MiroFish mock output
- `POST /api/mirofish/import` — import an arbitrary MiroFish payload
- `POST /api/mirofish/import-sample` — import the bundled mock

### Simulation (dummy target)
- `GET  /api/simulation/endpoints`
- `POST /api/simulation/request`
- `GET  /api/simulation/logs`

### Logs
- `GET  /api/logs/recent`
- `POST /api/logs/ingest`
- `POST /api/logs/ingest-batch`

### Defender
- `POST /api/defender/analyze-recent` — deterministic classify + incident pass
- `POST /api/defender/action` — execute a dummy defender action
- `GET  /api/defender/state`

### Incidents
- `GET   /api/incidents`
- `GET   /api/incidents/:id`
- `PATCH /api/incidents/:id/status`

### Agent tools (consumed by Bedrock Action Groups) — `/api/agent-tools`
**Attacker:** `GET /personas`, `GET /personas/{persona_name}`,
`GET /simulation-endpoints`, `POST /simulate-api-request`
**Defender:** `GET /recent-logs`, `POST /classify-log`, `POST /create-incident`,
`POST /execute-defender-action`, `GET /defender-state`

## Simulation access-control policy

Every simulated request produces **exactly one structured `LogEvent`**.

| Condition | Result |
| --- | --- |
| Endpoint does not exist | `404` + log |
| Endpoint exists, role mismatch | `403` + log |
| Endpoint exists, role matches | `200` + log |

- Admin endpoints (`/api/admin/*`) require `admin`.
- Report export (`/api/reports/export`) requires `admin` or `auditor`.
- Client data (`/api/clients/:id`) allows `rm`, `sales`, `admin`, `auditor` —
  never `external`.

## Fallback classifier (deterministic)

When the Bedrock Defender Agent isn't in the loop, the rule-based classifier in
[`utils/severityRules.ts`](src/utils/severityRules.ts) +
[`utils/patternMatch.ts`](src/utils/patternMatch.ts) drives everything:

| Threat type | Severity | Recommended dummy action |
| --- | --- | --- |
| `admin_endpoint_probing` | HIGH | `block_ip` |
| `credential_stuffing_attempt` | MEDIUM | `rate_limit_ip` |
| `report_export_abuse` | CRITICAL | `notify_admin` |
| `stale_account_abuse` | CRITICAL | `flag_user` |
| `normal_traffic` | LOW | `none` |

`POST /api/defender/analyze-recent` reads recent logs, classifies each, opens an
incident for every MEDIUM/HIGH/CRITICAL finding, and returns the created
incidents plus recommended actions (it does **not** auto-execute actions).

---

## Bedrock Red-Team Blue-Team Simulation

The end-to-end flow ties MiroFish, two Bedrock agents, and this backend together:

1. **MiroFish generates personas.** MiroFish produces attacker personas
   (goal, access type, intent, skill, risk appetite, target assets, tactics).
   The backend imports and normalizes them via `POST /api/personas/import`.

2. **The Bedrock Attacker Agent uses personas to simulate API requests.** Given a
   persona and the endpoint catalog (`GET /simulation-endpoints`), the agent
   decides which simulated requests to send and calls
   `POST /simulate-api-request` through its Action Group. The backend is a
   **dummy target** — it only evaluates access control and logs.

3. **The backend creates logs from simulated requests.** Every simulated request
   yields one structured `LogEvent` (allowed/denied, status code, role,
   persona, ip, user_id, reason).

4. **The Bedrock Defender Agent analyzes logs and executes dummy defense
   actions.** The Defender Agent reads recent logs (`GET /recent-logs`),
   classifies threats (`POST /classify-log`), opens incidents
   (`POST /create-incident`), and runs **safe simulated** actions
   (`POST /execute-defender-action`) such as `block_ip` or `flag_user`. Nothing
   real changes; every action is stored with `simulated: true`.

5. **The dashboard displays the timeline, incidents, and defender state.** A
   frontend can poll `GET /api/simulation/logs` (timeline),
   `GET /api/incidents` (incidents), and `GET /api/defender/state` (blocked IPs,
   flagged users, notifications) to visualize the red-vs-blue match.

### Bedrock Action Group wiring

- OpenAPI schemas: [`bedrock/openapi.attacker-agent.yaml`](src/bedrock/openapi.attacker-agent.yaml),
  [`bedrock/openapi.defender-agent.yaml`](src/bedrock/openapi.defender-agent.yaml)
- Lambda handlers: [`bedrock/lambdaAttackerActionGroup.handler.ts`](src/bedrock/lambdaAttackerActionGroup.handler.ts),
  [`bedrock/lambdaDefenderActionGroup.handler.ts`](src/bedrock/lambdaDefenderActionGroup.handler.ts)

Each handler inspects `event.apiPath` + `event.httpMethod`, calls the matching
internal service, and returns the Bedrock-Agent response envelope:

```json
{
  "messageVersion": "1.0",
  "response": {
    "actionGroup": "...",
    "apiPath": "...",
    "httpMethod": "...",
    "httpStatusCode": 200,
    "responseBody": { "application/json": { "body": "<JSON string>" } }
  }
}
```

### Suggested Bedrock Agent instructions

**Attacker Agent (red team):**

> You are a red-team simulation agent operating ONLY inside a sandboxed,
> simulated environment. You never attack real systems. You are given an
> attacker persona (goal, access_type, intent, skill_level, risk_appetite,
> target_assets, preferred_tactics). 
>
> 1. Call `getPersonaDetail` (or `getPersonas`) to load your assigned persona.
> 2. Call `listSimulationEndpoints` to see the target catalog, each endpoint's
>    required role, and sensitivity.
> 3. Plan a short sequence of simulated requests consistent with your persona —
>    e.g. an external malicious persona probes `/api/admin/*`; a credential
>    stuffing bot hammers `/api/login`; a stale account quietly reuses access.
> 4. For each step call `simulateApiRequest` with persona_name, method,
>    endpoint, role, user_agent, and (when relevant) ip and user_id. Use a role
>    consistent with your access_type; pick `unknown`/`external` when probing.
> 5. Observe the returned status_code and reason, then adapt your next step.
>
> Stay in character, keep the number of requests reasonable, and remember every
> action is simulated and logged — do nothing outside these tools.

**Defender Agent (blue team):**

> You are a blue-team SOC analyst agent operating on a stream of simulated
> security logs. All of your defensive actions are SAFE SIMULATIONS — you never
> change real infrastructure, send real email, or disable real accounts.
>
> 1. Call `getRecentLogs` to pull the latest log events.
> 2. For each suspicious log call `classifyLog` (pass log_id) to get a
>    threat_type, severity, and recommended_action. Follow this mapping:
>    admin_endpoint_probing → HIGH → block_ip;
>    credential_stuffing_attempt → MEDIUM → rate_limit_ip;
>    report_export_abuse → CRITICAL → notify_admin;
>    stale_account_abuse → CRITICAL → flag_user;
>    normal_traffic → LOW → none.
> 3. For any MEDIUM/HIGH/CRITICAL finding, call `createIncident` with the
>    threat_type, severity, persona_name, log_ids, and recommended_action.
> 4. Then call `executeDefenderAction` with the recommended action_type and the
>    correct target (ip for block/rate-limit, user_id for flag_user,
>    "security-admin" for notify_admin), passing the incident_id.
> 5. Call `getDefenderState` to confirm the simulated state and summarize what
>    you contained.
>
> Be decisive but proportionate: do not escalate `normal_traffic`, and never
> claim a real-world action was taken.

## License

MIT
