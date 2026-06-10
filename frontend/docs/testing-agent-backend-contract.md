# Testing Agent / Attacker App Backend Contract

> How the Sandboxed Defender app talks to the collaborator backend that runs the
> attack/fraud simulation agents (Bedrock / Lambda / custom). **Safe simulation
> only** — `safe_mode` is always forced true; no real credentials/payment.

## Stage 3 summary (read first)

- The **browser only calls `/api/testing/launch`** (this app's own route). It
  never calls the attacker app, AWS, or Bedrock directly.
- That route reads the **server-side** API key and forwards to the attacker app.
- Env vars (server-only; keys are **never** `NEXT_PUBLIC_`):
  - `TESTING_AGENT_MODE` = `mock` | `external`
  - `ATTACKER_APP_BASE_URL` (or legacy `TESTING_AGENT_BACKEND_URL`)
  - `ATTACKER_APP_API_KEY` (or legacy `TESTING_AGENT_API_KEY`)
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
