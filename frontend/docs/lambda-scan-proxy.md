# Lambda Red-Team Scan Proxy

> **Safe hackathon simulation.** This app contains no real exploitation logic.
> The controlled scan runs inside the collaborator's AWS Lambda (Claude agents);
> this app only signs the request and renders the findings.

## Why the browser cannot call the Lambda directly

The Lambda **Function URL uses AWS_IAM auth**, so every request must be
**AWS SigV4-signed**, which requires AWS secret credentials. Putting those in
front-end code would expose them to anyone. So the browser never calls the
Lambda directly — it calls a **server-side Next.js route** that holds the
credentials and signs the request.

## Architecture

```
Browser / Frontend  (LambdaScanCard)
  → POST /api/redteam/scan            (plain JSON, no AWS keys)
  → Next.js route handler (server-only, runtime="nodejs")
      → aws-sigv4.ts SigV4-signs with backend creds
      → AWS Lambda Function URL
      → Claude agents run the scan
      → findings returned
  → scanTarget() returns findings to the client
  → importRedTeamFindings() converts findings → SecurityTickets
  → dashboard / ticket queue / ticket detail update automatically
```

## Files

| File | Role |
|---|---|
| `src/lib/aws-sigv4.ts` | **Server-only** SigV4 signer. Never import from a client component. |
| `src/app/api/redteam/scan/route.ts` | The proxy route (`runtime="nodejs"`, `maxDuration=300`). Mock + external modes. |
| `src/lib/redteam-scan.service.ts` | Client service — calls **only** `/api/redteam/scan`. |
| `src/lib/redteam-scan.types.ts` | Shared request/response/finding types. |
| `src/lib/redteam-finding-to-ticket.adapter.ts` | Findings → `SecurityTicket`. Severity normalization. |
| `src/stores/ticket.store.ts` | `importRedTeamFindings(response, context)`. |
| `src/components/redteam/LambdaScanCard.tsx` | The scan UI (target, agents, preview, import). |

## Required environment variables (server-only — never `NEXT_PUBLIC_`)

| Var | Purpose |
|---|---|
| `REDTEAM_SCAN_MODE` | `mock` (no AWS) or `external` (real Lambda) |
| `AWS_REGION` | `us-east-1` |
| `LAMBDA_FUNCTION_URL` | the collaborator's Function URL |
| `REDTEAM_SCAN_TIMEOUT_MS` | proxy timeout (default `300000`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | required in `external` mode |
| `AWS_SESSION_TOKEN` | only for temporary (STS / SSO) credentials |

Copy `.env.example` → `.env.local` and fill in values. `.env.local` is
gitignored; `.env.example` is the tracked template (no real secrets).

## Example: frontend request (to OUR proxy)

```ts
import { scanTarget } from "@/lib/redteam-scan.service";

const res = await scanTarget({
  target: "http://54.84.126.64:8080",
  scope: ["54.84.126.64:8080"],   // optional; proxy defaults to [host:port]
  agents: 5,
  // local metadata only (Lambda ignores these — used for ticket context):
  attacker_id: "external-admin-hunter",
  attacker_name: "External Admin Endpoint Hunter",
  safe_mode: true,
});
console.log(res.findings);
```

## Example: backend request (proxy → Lambda)

The proxy MUST send `authorized: true` and `mode: "llm-swarm"`. It does **not**
forward `safe_mode` / `attacker_*` (the Lambda ignores them):

```json
{
  "target": "http://54.84.126.64:8080",
  "authorized": true,
  "scope": ["54.84.126.64:8080"],
  "mode": "llm-swarm",
  "agents": 5
}
```

## Expected Lambda response shape

```json
{
  "ok": true,
  "target": "http://54.84.126.64:8080",
  "mode": "llm-swarm",
  "summary": { "total": 14, "critical": 3 },
  "findings": [
    {
      "title": "Broken Authentication - Login Rejects Valid Credentials",
      "severity": "critical",
      "vector": "llm",
      "persona": "🔨 The Brute",
      "endpoint": "http://54.84.126.64:8080",
      "evidence": "...",
      "poc": "...",
      "remediation": "...",
      "confirmed": true
    }
  ]
}
```

**Important quirks**
- `severity` is **lowercase** (`critical/high/medium/low/info`) — the adapter's
  `normalizeSeverity()` upper-cases it and maps unknown/`info` → `INFO`.
- `summary` carries **only** `total` + `critical` — derive the rest from
  `findings[]` (the UI counts per-severity from findings, never the summary).
- `evidence` is a plain string.

## Error responses

| Status | Meaning |
|---|---|
| `400 missing 'target'` | no target supplied |
| `403 'authorized' must be true` | proxy forgot `authorized: true` |
| `403 SCOPE ERROR: ...` | target not in `scope` |

The proxy maps Lambda non-2xx → `502 { ok:false, provider:"lambda", error }`,
timeouts → `504 { ok:false, error:"scan timed out" }`, and never leaks AWS
credentials or signing internals in any error body.

## Hosting / timeout caveat

A synchronous proxy that waits minutes works in **local `next dev`** and on Node
hosts that honor `maxDuration`. On **Vercel Hobby** (and similar serverless), the
function is killed at 10–60s and will **504** before a multi-agent scan finishes.
For the demo: run locally, or keep `agents` at 3–5.

**Production TODO — switch to async:**
```
POST /api/redteam/scan/start    → { job_id }
GET  /api/redteam/scan/status/:job_id
```
(Not built yet — the synchronous proxy is sufficient for the local demo.)

## Security notes

- AWS keys stay **server-side only**; never `NEXT_PUBLIC_`.
- The browser calls **only** `POST /api/redteam/scan`; it never touches the
  Lambda URL.
- `aws-sigv4.ts` and the route use `runtime = "nodejs"` (the AWS SDK can't run
  on the Edge runtime).
- This is a **safe simulation** — no real exploitation logic lives in this app.
