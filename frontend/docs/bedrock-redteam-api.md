# Bedrock Red-Team Simulation API

> **This is a safe simulation API. It does not attack real systems, use real
> credentials, block real traffic, or expose real data.** Every endpoint below is
> a controlled stand-in for a hackathon red-team/blue-team demo.

The Next.js app (default port **3001**) exposes a small set of route handlers so
a Bedrock attacker agent can drive a simulated red-team run and have the results
appear as security tickets in the dashboard / ticket queue.

Base URL for local dev: `http://localhost:3001`

## Pipeline

```
Simulation Setup UI
  → loads attacker personas from GET /api/redteam/attackers
  → user selects a target endpoint + attacker persona
  → Bedrock attacker agent launches a controlled, simulated attack
  → app receives the attack (POST /api/redteam/attack OR a dummy /api/sim-target/* hit)
  → app classifies + stores a structured red-team event (in-memory)
  → client polls GET /api/redteam/events and imports new events into the
    browser ticket store
  → dashboard / ticket queue / ticket detail update automatically
```

---

## 1. `GET /api/redteam/attackers`

Returns the selectable attacker personas.

**Response**

```json
{
  "attackers": [
    {
      "id": "external-admin-hunter",
      "name": "External Admin Endpoint Hunter",
      "display_name": "External Admin Endpoint Hunter",
      "description": "External actor probing admin endpoints for weak authorization.",
      "category": "external",
      "skill_level": "medium",
      "risk_appetite": "high",
      "default_attack_type": "admin_endpoint_probing",
      "supported_attack_types": ["admin_endpoint_probing", "network_recon", "web_exploit"],
      "tags": ["admin", "external", "recon"]
    }
  ]
}
```

The frontend selects by `id` — never by display name. The collaborator can
replace this response with Bedrock-backed personas; keep the
`{ "attackers": [...] }` shape (the client also accepts `{ "data": [...] }` or a
bare array).

---

## 2. `POST /api/redteam/attack`

The Bedrock attacker agent reports a single simulated attack here. The route
validates, classifies, stores, and echoes the classified event.

**Request body** (`SimulationAttackRequest`)

```json
{
  "run_id": "RUN-001",
  "attack_id": "ATTACK-001",
  "attack_type": "admin_endpoint_probing",
  "attacker": {
    "persona_name": "External Admin Endpoint Hunter",
    "actor_type": "external",
    "source_ip": "198.51.100.24",
    "user_agent": "Bedrock-RedTeam-Agent"
  },
  "target": {
    "method": "POST",
    "endpoint": "/api/admin/reset-user-data",
    "asset": "admin_api"
  },
  "metadata": {
    "confidence": 0.92,
    "notes": "Simulated admin endpoint probe"
  }
}
```

**`attack_type`** ∈ `admin_endpoint_probing` · `credential_stuffing` ·
`report_export_abuse` · `stale_account_abuse` · `insider_data_access` ·
`network_recon` · `dns_spoofing` · `smtp_relay_abuse` · `firewall_bypass` ·
`web_exploit`

**`actor_type`** ∈ `external` · `internal` · `stale_account` · `unknown`

**Response** `201` (`RedTeamAttackResponse`)

```json
{
  "ok": true,
  "simulated": true,
  "event": { "...": "SimulationIncidentEvent (severity, defender action, evidence, recommendations, ai_analysis)" },
  "message": "Red-team attack event received"
}
```

Validation errors return `422` with `{ "ok": false, "errors": [...] }`.
Invalid JSON returns `400`.

---

## 3. `GET /api/redteam/events`

Returns every classified event currently in the in-memory store (oldest →
newest). The browser polls this every ~4s and imports new events by `event_id`.

```json
{ "ok": true, "simulated": true, "events": [ /* SimulationIncidentEvent[] */ ] }
```

## 4. `DELETE /api/redteam/events`

Clears the in-memory event store (demo reset).

```json
{ "ok": true, "simulated": true, "cleared": 12 }
```

> The event store is **in-memory only** (ephemeral, single-instance). Replace
> with a database or durable queue for production.

---

## 5. Dummy target endpoints (`/api/sim-target/*`)

The Bedrock agent can hit these directly instead of (or in addition to)
`/api/redteam/attack`. Each one synthesizes a `SimulationAttackRequest`,
classifies it, stores the event, and returns a **simulated** status + body. They
expose **no real data**.

| Method | Endpoint | Attack type | Simulated result |
|--------|----------|-------------|------------------|
| POST | `/api/sim-target/login` | `credential_stuffing` | `401` |
| GET  | `/api/sim-target/leads` | `insider_data_access` | `200` |
| POST | `/api/sim-target/leads` | `insider_data_access` | `200` |
| GET  | `/api/sim-target/clients/{id}` | `insider_data_access` | `200` |
| GET  | `/api/sim-target/reports/export` | `report_export_abuse` | `403` unless `actor_type=internal` |
| POST | `/api/sim-target/admin/reset-user-data` | `admin_endpoint_probing` | `403` for external/unknown |
| GET  | `/api/sim-target/admin/users` | `admin_endpoint_probing` | `403` for external/unknown |
| GET  | `/api/sim-target/admin/config` | `admin_endpoint_probing` | `403` for external/unknown |

**Attacker hints** (optional) via headers or JSON body:

| Header | Body field | Meaning |
|--------|-----------|---------|
| `x-sim-actor-type` | `attacker.actor_type` | `external`/`internal`/`stale_account`/`unknown` |
| `x-sim-persona` | `attacker.persona_name` | display name of the persona |
| `x-sim-user-id` | `attacker.user_id` | actor id (use `ex_*`/`stale_*` to trigger stale-account flags) |
| `x-sim-source-ip` | — | simulated source IP |
| `x-sim-run-id` | `run_id` | groups events into one run |

Status-code rules: admin endpoints → `403` for external/unknown; login →
`401`; report export → `403` unless `internal`; stale-account abuse → `200` but
flagged.

---

## 6. Example request bodies

**Admin endpoint probing** (`POST /api/redteam/attack`)

```json
{
  "run_id": "RUN-001",
  "attack_type": "admin_endpoint_probing",
  "attacker": { "persona_name": "External Admin Endpoint Hunter", "actor_type": "external", "source_ip": "198.51.100.24" },
  "target": { "method": "POST", "endpoint": "/api/admin/reset-user-data", "asset": "admin_api" },
  "metadata": { "confidence": 0.92, "notes": "Simulated admin endpoint probe" }
}
```

**Credential stuffing**

```json
{
  "run_id": "RUN-002",
  "attack_type": "credential_stuffing",
  "attacker": { "persona_name": "Credential Stuffing Bot", "actor_type": "external", "source_ip": "198.51.100.77", "user_agent": "Bedrock-RedTeam-Agent" },
  "target": { "method": "POST", "endpoint": "/api/login", "asset": "auth_api" },
  "metadata": { "confidence": 0.8, "notes": "Replaying leaked credentials" }
}
```

**Report export abuse**

```json
{
  "run_id": "RUN-003",
  "attack_type": "report_export_abuse",
  "attacker": { "persona_name": "Report Export Abuser", "actor_type": "external", "source_ip": "198.51.100.91" },
  "target": { "method": "GET", "endpoint": "/api/reports/export", "asset": "reports_api" }
}
```

**Stale account abuse**

```json
{
  "run_id": "RUN-004",
  "attack_type": "stale_account_abuse",
  "attacker": { "persona_name": "Stale Account User", "actor_type": "stale_account", "user_id": "ex_jdoe", "source_ip": "10.0.0.42" },
  "target": { "method": "GET", "endpoint": "/api/sim-target/leads", "asset": "leads_api" }
}
```

---

## 7. Example curl commands

```bash
# 1. List attacker personas
curl -s http://localhost:3001/api/redteam/attackers | jq

# 2. Report a simulated admin endpoint probe
curl -s -X POST http://localhost:3001/api/redteam/attack \
  -H 'Content-Type: application/json' \
  -d '{
    "run_id": "RUN-001",
    "attack_type": "admin_endpoint_probing",
    "attacker": { "persona_name": "External Admin Endpoint Hunter", "actor_type": "external", "source_ip": "198.51.100.24" },
    "target": { "method": "POST", "endpoint": "/api/admin/reset-user-data", "asset": "admin_api" },
    "metadata": { "confidence": 0.92, "notes": "Simulated admin endpoint probe" }
  }' | jq

# 3. Read stored events (what the browser polls)
curl -s http://localhost:3001/api/redteam/events | jq '.events | length'

# 4. Hit a dummy target directly (classifies + stores automatically)
curl -s -X POST http://localhost:3001/api/sim-target/admin/reset-user-data \
  -H 'x-sim-actor-type: external' \
  -H 'x-sim-persona: External Admin Endpoint Hunter' | jq

# 5. Clear all events (demo reset)
curl -s -X DELETE http://localhost:3001/api/redteam/events | jq
```

---

## 8. Launch payload (future `POST /api/redteam/launch`)

The setup UI builds this via `buildSimulationLaunchPayload(target, attacker)`
(see `src/lib/simulation-launch.adapter.ts`). It is the shape Bedrock should
receive to start a run:

```json
{
  "target": { "base_url": "http://localhost:3001", "environment": "demo", "selected_endpoint": "/api/sim-target/admin/reset-user-data" },
  "attacker": {
    "id": "external-admin-hunter",
    "name": "External Admin Endpoint Hunter",
    "category": "external",
    "default_attack_type": "admin_endpoint_probing",
    "supported_attack_types": ["admin_endpoint_probing", "network_recon", "web_exploit"]
  }
}
```

`POST /api/redteam/launch` is not implemented yet — it is marked `TODO(api)` in
the adapter and the setup card. Until it exists, the UI fires the selected dummy
target directly so the full pipeline is demonstrable.
```
