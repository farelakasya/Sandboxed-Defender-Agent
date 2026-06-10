# Frontend ↔ Backend Contract (Sandboxed Defender)

This app is the **Defender Platform**. There are two backends it talks to, and
the rules below are the source of truth for how the frontend reaches each.

## 1. Defender backend — source of truth

The defender backend (EC2) owns dashboard metrics, tickets, ticket detail, and
status updates. The browser calls a **same-origin proxy** and never hits the
EC2 host directly (keeps HTTPS deploys mixed-content safe).

```
Browser → /api/defender/*  (Next.js proxy, src/app/api/defender/[...path]/route.ts)
        → ${DEFENDER_BACKEND_URL}/*   (server-side)
```

Path mapping:

| Browser (proxy)                          | Backend                         |
|------------------------------------------|---------------------------------|
| `/api/defender/health`                   | `/health`                       |
| `/api/defender/tickets?limit&offset`     | `/api/tickets?limit&offset`     |
| `/api/defender/tickets/:id`              | `/api/tickets/:id`              |
| `PATCH /api/defender/tickets/:id/status` | `PATCH /api/tickets/:id/status` |
| `/api/defender/dashboard/metrics`        | `/api/dashboard/metrics`        |
| `/api/defender/dashboard/per-ip?limit`   | `/api/dashboard/per-ip?limit`   |
| `/api/defender/dashboard/distributions`  | `/api/dashboard/distributions`  |
| `/api/defender/dashboard/timeline?limit` | `/api/dashboard/timeline?limit` |

### Dashboard aggregates (DB-wide)

- `GET /api/dashboard/distributions` → `by_severity`, `by_attack_type` (incl.
  `normal_traffic`), `by_detection_label` (multi-label: attack/anomaly/fraud),
  `by_defender_action`, `by_endpoint` (top 20; `/login` is the most attacked),
  `top_recommended_fixes` (ranked, **priority uppercase — do not lowercase**).
  Backend caches ~45s and never 500s. Consumed by
  `dashboard-aggregates.backend.service.ts` (`getDefenderDashboardDistributions`).
- `GET /api/dashboard/timeline?limit=20` (max 200) → `{ events: [{ id,
  ticket_id, timestamp, event, description, severity, attack_type }] }`,
  timestamps UTC `Z`. Consumed via `getDefenderDashboardTimeline`.
- Both fetches degrade to client-side derivation if unavailable (mock mode or
  endpoint down) — the dashboard never crashes.

### Ticket list filtering / sorting (server-side)

`GET /api/tickets?status=&severity=&sort=&order=&limit=&offset=`

- `status` (e.g. `auto_contained`), `severity` (e.g. `CRITICAL`), `sort`
  (`created_at`|`risk_score`|`severity`), `order` (`asc`|`desc`).
- **`total` in the response is the FILTERED count** — use it for pagination
  (Load More), not the loaded array length.
- The UI pushes status/severity/sort/order to the backend and resets offset to 0
  on change; search / attack-type / endpoint / time-range stay client-side.
- Response shape accepted: array, or `{ tickets|data|items, total, limit, offset }`.

### Real ticket fields — backend mode never fabricates (N/A rule)

The backend populates ticket fields from the DB. In **backend mode the
normalizer (`tickets.backend.service.ts`) uses EXPLICIT backend fields only** —
if a field is absent it is left empty/undefined and the UI shows **N/A**
(`displayOrNA` / `NaOr` / `Na` in `ticket.utils.ts` + `components/tickets/
Field.tsx`). It does **not** synthesize:
`mitigation_actions`, `containment_status`, `developer_notification`,
`recommended_fixes`, `ai_analysis`/`analyzer_summary`, or any timestamp (no
`new Date()` fallback). Timestamps are UTC `Z` (ISO offsets also parse).

Allowed derived values (not fabrication): severity/findings counts, high-risk %
from distribution counts, formatted timestamps, and status badge colors.

Mock mode (`NEXT_PUBLIC_USE_MOCK_DATA=true`) still uses the local store/factory
with full demo values; **backend mode never falls back to mock/store data** —
the Ticket Queue and Ticket Detail show only backend tickets (an error banner is
shown when the backend is unavailable, not mock data). The `DetectionEventSync`
and `RedTeamEventSync` store bridges are **gated to mock mode** so backend mode
is never polluted with synthetic tickets.

Env:

```
NEXT_PUBLIC_USE_MOCK_DATA=false          # false = backend mode, true = mock mode
DEFENDER_BACKEND_URL=http://54.84.126.64:8001   # server-only; proxy forwards here
NEXT_PUBLIC_DEFENDER_API_BASE_URL=...    # optional: browser hits backend directly (debug)
```

**Notifications are read-only.** `NotificationStatusCard` shows the backend
status (`sent | pending | failed | not_required`); when the backend returns no
`developer_notification` object it shows **N/A** (no fabricated "handled
automatically" status). There is no manual "Notify Developer" action.

## 2. Tier2 AI-Pentest backend — external, via proxy

A single **async** AI-pentest backend (v2). No fraud, no vector catalog, no
domains, no synchronous report, no callbacks, no ticket correlation. The
**browser only calls this app's routes** (`/api/testing/scope`,
`/api/testing/launch`, `/api/testing/scan/:id`); the proxy adds the API key
server-side. The browser never calls the attacker backend or AWS directly.

```
Browser → GET  /api/testing/scope           → external GET {BASE}{SCOPE_PATH}  header x-api-key
        ← { scope: string[] }   // "host:port" presets (IP/hostname/CIDR)
Browser → POST /api/testing/launch          { ip, port, endpoint, scheme, authorized:true }
        → external POST {BASE}{SCAN_PATH}    header x-api-key
        ← 202 { scan_id, status:"QUEUED" }
Browser → GET /api/testing/scan/:scan_id     (poll every ~15s, stop on terminal)
        → external GET  {BASE}{SCAN_PATH}/{scan_id}   header x-api-key
        ← Scan { status, engine, target{ip,port,endpoint,scheme,url}, profile,
                 scenario, report_url, error, created_at, findings[] }
```

The attacker backend does **not** create defender tickets. After a scan the
launch page may re-fetch `/api/defender/tickets` and show **possible** related
tickets (endpoint/host + time heuristic) — never confirmed links. Scan
findings/profile/scenario are shown only on the scan panel (`PentestScanPanel`),
with **N/A** for any missing field; they are never converted into defender
tickets.

Env (server-only; **key never `NEXT_PUBLIC_`, never logged**):

```
TESTING_AGENT_MODE=mock                 # mock | external
ATTACKER_APP_BASE_URL=                  # external requires this (incl. API GW stage)
ATTACKER_APP_SCAN_PATH=/scan            # scan path; poll = {scan path}/{scan_id}
ATTACKER_APP_SCOPE_PATH=/scope          # scope path → preset "host:port" targets
ATTACKER_APP_API_KEY=                   # API key (sent as a header)
ATTACKER_APP_AUTH_HEADER=x-api-key      # x-api-key (default, API GW) | bearer
```

Real backend (set in Vercel env, key in Vercel only — never `NEXT_PUBLIC_API_KEY`):

```
TESTING_AGENT_MODE=external
ATTACKER_APP_BASE_URL=https://r578qyt8l2.execute-api.us-east-1.amazonaws.com/prod
ATTACKER_APP_SCAN_PATH=/scan
ATTACKER_APP_API_KEY=<set in Vercel only>
ATTACKER_APP_AUTH_HEADER=x-api-key
```

- **Launch body:** `{ ip, port (1–65535), endpoint ("/..."), authorized:true }`
  (validated server-side; `authorized` must be exactly `true`).
- **Statuses:** `QUEUED | RUNNING | DONE | FAILED | REJECTED` (last three terminal).
- **Polling:** every ~15s, stop on terminal; transient errors back off and keep
  the `scan_id`. **Severities lowercase.** Targets are `http://ip:port` (HTTPS
  unsupported); off-allowlist targets → `REJECTED`.
- **Mock mode:** in-memory async scan (QUEUED→RUNNING→DONE with a sample profile,
  scenario, and findings). No external backend needed.
- **Errors:** clean JSON — `404 not_found`, `403 forbidden`, `400
  validation_error`, `502` upstream — never the key/headers/stack traces.

## 3. No fraud launch / no report↔ticket correlation

- **Fraud launch is not supported** by this backend. The Fraud Launch nav item is
  hidden by default; its page shows an "unsupported" notice (the in-browser sim
  stays for demos). Defender **fraud/anomaly tickets and dashboard labels come
  from the defender DB** and are unrelated to attacker launches — they remain.
- The Tier2 scan has **no** `mapped_ticket_id` / `linked_ticket_ids` /
  `defender_result`. The pentest result (`PentestScanPanel`) is launch-side only
  and never creates defender tickets. Findings render directly from the Scan
  object; summary counts are derived from `findings` (not backend-provided).
