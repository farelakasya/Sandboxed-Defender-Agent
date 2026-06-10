# Testing Agent / Attacker App Backend Contract

> ⚠️ **CURRENT contract (Tier2 AI-Pentest) — read this; the sections below it are
> historical and describe the old multi-vector/fraud assumption that no longer
> applies.**

## Tier2 AI-Pentest backend v2 (current)

A single async AI-pentest backend. **No** domains, vector catalog, fraud,
synchronous report, callbacks, ticket correlation, options/max_steps/
max_attempts/safe_mode. Opus chooses techniques at runtime.

**Flow:** read the allowlist (`/scope`) → launch a scan against an authorized
target → get `scan_id` → poll until terminal. The browser only calls this app's
routes; the proxy adds the API key server-side and the browser never touches the
attacker backend / AWS directly.

```
Browser → GET  /api/testing/scope               → external GET  {BASE}{SCOPE_PATH}   header x-api-key
        ← { scope: string[] }   // "host:port" presets (host may be IP/hostname/CIDR)
Browser → POST /api/testing/launch              { ip, port, endpoint, scheme, authorized:true }
        → external POST {BASE}{SCAN_PATH}        header x-api-key
        ← 202 { scan_id, status:"QUEUED" }
Browser → GET  /api/testing/scan/:scan_id       (poll every ~15s)
        → external GET  {BASE}{SCAN_PATH}/{scan_id}   header x-api-key
        ← Scan object (status QUEUED→RUNNING→DONE/FAILED/REJECTED)
```

Env (server-only; key never `NEXT_PUBLIC_`, never logged):

```
TESTING_AGENT_MODE=external
ATTACKER_APP_BASE_URL=https://r578qyt8l2.execute-api.us-east-1.amazonaws.com/prod
ATTACKER_APP_SCAN_PATH=/scan
ATTACKER_APP_SCOPE_PATH=/scope
ATTACKER_APP_API_KEY=<set in env / Vercel only>
ATTACKER_APP_AUTH_HEADER=x-api-key
```

- **`GET /scope`:** `{ "targets": ["54.84.126.64:80", "api.cashlo.id:443", "10.0.0.0/24"] }`.
  The frontend proxy normalizes this to `{ scope: string[] }`. The launch UI
  parses each `host:port` into a selectable preset (scheme inferred from the
  port: 443/8443 → https); CIDR ranges aren't single launchable targets and are
  skipped in the dropdown.
- **Launch body:** `{ ip, port: 1–65535, endpoint: "/...", scheme: "http"|"https", authorized: true }`
  (validated server-side; `scheme` optional, defaults `https`; `authorized` must
  be exactly `true`). `ip` may be an IP **or** hostname. **Nothing else is sent** —
  no domain/vector/options/max_steps/max_attempts/safe_mode/callback.
- **Scan object:** `scan_id, status, engine, target{ip,port,endpoint,scheme,url},
  profile|null, scenario|null, report_url|null, error|null, created_at, findings[]`.
- **Statuses:** `QUEUED | RUNNING | DONE | FAILED | REJECTED` (last three terminal).
- **Polling:** every ~15s; stop on terminal; transient poll errors back off and
  keep the `scan_id` (run not lost).
- **Severities:** lowercase (`critical|high|medium|low|info`).
- **Targets:** backend builds `{scheme}://{ip}:{port}{endpoint}`. Targets are
  allowlisted server-side; off-allowlist → `REJECTED`.
- **No fraud launch.** Defender fraud/anomaly data on the dashboard/tickets comes
  from the defender DB and is unrelated to this backend.
- **No report→ticket correlation.** The attacker backend does NOT create defender
  tickets and returns no `mapped_ticket_id` / `linked_ticket_ids` /
  `defender_result`. The launch page may re-fetch the defender backend's recent
  tickets after a scan and show them as **possible** related tickets (endpoint/
  host + time heuristic) — never confirmed links. If the defender backend later
  exposes a real `scan_id`/correlation field, switch to that.
- **Scan findings are NOT defender verdicts.** Findings/profile/scenario are
  rendered only on the launch/scan panel; they are never converted into defender
  tickets or merged into ticket fields.
- **Errors:** proxy returns clean JSON — `404 not_found`, `403 forbidden`,
  `400 validation_error`, `502` upstream — never the key, headers, or stack traces.

---

## (Historical) Stage 2–3 multi-vector / fraud assumption

> The text below predates the Tier2 contract. The `/launch` path, AgentCommand
> body, `domain`/`vector_id`/`safe_mode`, synchronous report, and fraud support
> described here are **no longer used**. Kept for history only.

> How the Sandboxed Defender app talks to the collaborator backend that runs the
> attack/fraud simulation agents (Bedrock / Lambda / custom). **Safe simulation
> only** — `safe_mode` is always forced true; no real credentials/payment.

## Stage 3 summary (read first)

- The **browser only calls `/api/testing/launch`** (this app's own route). It
  never calls the attacker app, AWS, or Bedrock directly.
- That route reads the **server-side** API key and forwards to the attacker app.
- Env vars (server-only; keys are **never** `NEXT_PUBLIC_`, never logged):
  - `TESTING_AGENT_MODE` = `mock` | `external`
  - `ATTACKER_APP_BASE_URL` (or legacy `TESTING_AGENT_BACKEND_URL`)
  - `ATTACKER_APP_LAUNCH_PATH` = path under the base, default `/launch`
  - `ATTACKER_APP_API_KEY` (or legacy `TESTING_AGENT_API_KEY`)
  - `ATTACKER_APP_AUTH_HEADER` = `x-api-key` (default, AWS API Gateway) | `bearer`

### Connecting the real attacker backend (AWS API Gateway)

Set these server-side (locally in `.env.local`, on deploys in Vercel env — never
commit the key, never use `NEXT_PUBLIC_`):

```
TESTING_AGENT_MODE=external
ATTACKER_APP_BASE_URL=https://r578qyt8l2.execute-api.us-east-1.amazonaws.com/prod
ATTACKER_APP_LAUNCH_PATH=/launch
ATTACKER_APP_API_KEY=<set in Vercel only>
ATTACKER_APP_AUTH_HEADER=x-api-key
```

The route forwards to `${ATTACKER_APP_BASE_URL}${ATTACKER_APP_LAUNCH_PATH}`
(the API Gateway stage prefix in the base is preserved) with the key in the
`x-api-key` header. Troubleshooting:
- **404** → `ATTACKER_APP_LAUNCH_PATH` is likely wrong; confirm the exact launch
  path with the teammate and update the env var only (no code change).
- **401/403** → check `ATTACKER_APP_AUTH_HEADER` and the key.
- **422/400** → request body schema mismatch; confirm the expected body before
  changing the `AgentCommand` shape.
- **Mock mode** works with no attacker app: the launch pages render a synthesized
  `AttackerReport` (see `src/lib/attacker-report.types.ts`).
- **External mode** requires `ATTACKER_APP_BASE_URL`; the bearer key is sent only
  if configured. Missing URL → clean JSON error, no stack trace.
- **Defender tickets come from the defender backend DB**, not from the attacker
  report store. A report may reference tickets via `mapped_ticket_id` /
  `linked_ticket_ids` once the backend records the matching verdict; until then
  the panel shows "Defender tickets will appear once the backend records the
  verdict."
- If the attacker app returns a structured `report` in its launch response, the
  launch pages render it as-is; otherwise the report is synthesized client-side
  from the selected vector.

## Flow

```
Browser  → POST /api/testing/launch        (our route; plain JSON, no secrets)
         → backend looks up vector, builds AgentCommand
         → POST ${TESTING_AGENT_BACKEND_URL}/launch   (server-side, Bearer key)
         → collaborator backend runs the agent against the target
         → agent reports detection events:
              POST ${NEXT_PUBLIC_APP_BASE_URL}/api/detection/events
         → our DetectionEventSync imports them → tickets + dashboard update
```

The browser **never** calls the collaborator backend / AWS directly. Only our
own Next.js routes do.

## 1. Endpoint our app calls

```
POST ${TESTING_AGENT_BACKEND_URL}/launch
Content-Type: application/json
Authorization: Bearer ${TESTING_AGENT_API_KEY}   # if configured
```

Body: an **AgentCommand**.

### AgentCommand fields

| field | type | notes |
|---|---|---|
| `run_id` | string | unique per launch |
| `domain` | `"attack" \| "fraud"` | |
| `agent_id` | string | logical agent (e.g. `fraud-simulation-agent`) |
| `task` | string | `simulate_<vector_id>` |
| `vector_id` | string | e.g. `card_cracking` |
| `vector_name` | string | human label |
| `target` | object | `{ base_url, endpoint?, target_type, environment }` |
| `strategy` | object | per-vector hints (safe) |
| `constraints` | object | `{ safe_mode, max_steps, max_attempts?, no_real_credentials, no_real_payment?, allowed_targets_only }` |
| `callback` | object | `{ event_url, result_url? }` |
| `expected_detection_labels` | string[] | subset of `anomaly`/`attack`/`fraud` |

### Example AgentCommand

```json
{
  "run_id": "RUN-20260610-AB12C",
  "domain": "fraud",
  "agent_id": "fraud-simulation-agent",
  "task": "simulate_card_cracking",
  "vector_id": "card_cracking",
  "vector_name": "Card Cracking",
  "target": {
    "base_url": "https://sandboxed-defender.vercel.app",
    "endpoint": "/api/sim-target/checkout/pay",
    "target_type": "payment_gateway",
    "environment": "demo"
  },
  "strategy": {
    "attempt_pattern": "repeated_failed_authorizations",
    "reuse_device_fingerprint": true,
    "vary_dummy_card_token": true,
    "velocity": "medium"
  },
  "constraints": {
    "safe_mode": true,
    "max_steps": 5,
    "max_attempts": 10,
    "no_real_credentials": true,
    "no_real_payment": true,
    "allowed_targets_only": true
  },
  "callback": {
    "event_url": "https://sandboxed-defender.vercel.app/api/detection/events"
  },
  "expected_detection_labels": ["attack", "fraud", "anomaly"]
}
```

## 2. Backend response (two supported modes)

**Synchronous** — return findings/events immediately. Our app stores them right
away. Any of these shapes works:

```json
{ "ok": true, "findings": [ /* event-ish */ ] }
{ "events": [ /* DetectionEvent */ ] }
{ "detection_events": [ /* DetectionEvent */ ] }
[ /* DetectionEvent */ ]
{ /* a single DetectionEvent */ }
```

**Async** — return a status and POST events later to the callback:

```json
{ "ok": true, "run_id": "RUN-...", "status": "queued" }
```

## 3. Callback endpoint the collaborator calls

```
POST ${NEXT_PUBLIC_APP_BASE_URL}/api/detection/events
Content-Type: application/json
```

Accepts a single event, an array, or `{events|detection_events|findings: [...]}`.

### Example callback event

```json
{
  "event_id": "EVT-001",
  "created_at": "2026-06-10T00:00:00.000Z",
  "source": "external_agent",
  "mode": "simulation",
  "event_type": "card_cracking",
  "domain_hint": "fraud",
  "actor": {
    "source_ip": "198.51.100.10",
    "user_agent": "FraudSimulationAgent/1.0",
    "device_id": "device_demo_01"
  },
  "target": {
    "endpoint": "/api/sim-target/checkout/pay",
    "method": "POST",
    "resource": "payment_gateway"
  },
  "evidence": [
    {
      "timestamp": "2026-06-10T00:00:00.000Z",
      "message": "Repeated failed payment authorization attempts from same device fingerprint",
      "status_code": 429
    }
  ],
  "raw": {}
}
```

Evidence items accept either our native shape
(`{ timestamp, type, summary, details }`) or a loose shape
(`{ message, status_code, ... }`) — the app normalizes both. Unknown
`event_type`s fall back to the `domain_hint`.

### `event_type` values the classifier understands

`card_cracking`, `account_takeover`, `chargeback_fraud`, `promo_abuse`,
`bot_checkout`, `credential_stuffing`, `stale_account_abuse`,
`admin_endpoint_probing`, `insider_data_access`, `report_export_abuse`,
`network_recon`, `dns_spoofing`, `smtp_relay_abuse`, `firewall_bypass`,
`web_exploit`, `normal_traffic`. Others classify by `domain_hint`.

## 4. Environment variables (server-only unless noted)

| var | purpose |
|---|---|
| `NEXT_PUBLIC_APP_BASE_URL` | **public** — used to build the callback URL |
| `TESTING_AGENT_MODE` | `mock` or `external` |
| `TESTING_AGENT_BACKEND_URL` | collaborator backend base URL |
| `TESTING_AGENT_API_KEY` | optional bearer key |

Secrets never use `NEXT_PUBLIC_`. In `mock` mode no external backend is needed —
the launch route synthesizes a safe DetectionEvent itself.

## 5. Related routes

- `POST /api/testing/launch` — unified vector launcher (this contract)
- `POST/GET/DELETE /api/detection/events` — event ingestion + client sync
- `POST /api/redteam/scan` — specialized Lambda SigV4 scan proxy (kept separate;
  see `docs/lambda-scan-proxy.md`)
