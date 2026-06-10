# Best-practice implementation prompt

Hand this to your Next.js coding agent. Reference implementations for PHASE 5–9
live alongside this file under `src/` (copy them in, or let the agent regenerate
to match your project).

---

Prepare the app to launch red-team scans through a secure backend proxy.

CONTEXT
This is a Next.js (App Router) / TypeScript app with:
- Dashboard
- Security Ticket Queue: /security/tickets
- Ticket Detail: /security/tickets/[ticketId]
- Zustand ticket store with localStorage persistence
- Simulation setup page where the user selects target/attacker
- Existing or planned ticket adapter/sync system

PROBLEM
A collaborator deployed an AWS Lambda Function URL that runs Claude-driven
red-team agents. The Function URL uses AWS_IAM auth, so EVERY request must be
AWS SigV4-signed. The browser must NOT call the Lambda directly (that would
expose AWS credentials). We need a server-side Next.js proxy that signs requests.

CORRECT ARCHITECTURE
Browser / Frontend
  → POST /api/redteam/scan          (plain JSON, no AWS keys)
  → Next.js API route (server-only)  (SigV4-signs the request)
  → AWS Lambda Function URL
  → Claude agents run the scan
  → findings returned
  → frontend imports findings into ticketing/dashboard

================================================================
AUTHORITATIVE API CONTRACT — do not deviate from this
================================================================
Lambda Function URL:
  https://n23oucit2pdvxg4uqfnktj4dia0gield.lambda-url.us-east-1.on.aws/
Auth: AWS_IAM (SigV4). Service name = "lambda". Region = "us-east-1". Method = POST.

REQUEST BODY the proxy MUST send to the Lambda (exact keys):
{
  "target": "http://HOST:PORT",     // required
  "authorized": true,               // REQUIRED — Lambda returns 403 without it
  "scope": ["HOST:PORT"],           // optional; defaults to [target] server-side
  "mode": "llm-swarm",              // REQUIRED to run the Claude agents.
                                    //   Omitting it defaults to "deterministic"
                                    //   (non-Claude agents) — NOT what we want.
  "agents": 5                       // integer 1..10 (Claude agents to fan out)
  // "model": optional full Bedrock id, e.g.
  //   "us.anthropic.claude-haiku-4-5-20251001-v1:0" (default haiku server-side)
}
NOTE: safe_mode / attacker_id / attacker_name are IGNORED by the Lambda. Keep
them only as local ticket metadata; do not rely on them affecting the scan.

RESPONSE BODY the Lambda returns:
{
  "ok": true,
  "target": "http://HOST:PORT",
  "mode": "llm-swarm",
  "summary": { "total": 14, "critical": 3 },   // ONLY total + critical are present
  "findings": [
    {
      "title": "string",
      "severity": "critical" | "high" | "medium" | "low" | "info",  // LOWERCASE
      "vector": "llm",
      "persona": "🔨 The Brute",
      "endpoint": "http://HOST:PORT",
      "evidence": "string",          // always a plain string
      "poc": "string",
      "remediation": "string",
      "confirmed": true
    }
  ]
}
ERROR CASES: 400 {"ok":false,"error":"missing 'target'"};
             403 {"ok":false,"error":"scan refused: 'authorized' must be true"};
             403 {"ok":false,"error":"SCOPE ERROR: ..."}.
KEY CONSEQUENCES:
- severity is LOWERCASE and includes "info" — normalize in the adapter.
- summary has ONLY {total, critical}. Derive high/medium/low counts from
  findings[], never assume summary contains them.
================================================================

GOAL
Implement a secure Next.js API proxy that receives plain JSON from the frontend,
signs the request to the Lambda Function URL with backend-only AWS credentials,
returns findings to the frontend, and prepares those findings to become
SecurityTickets.

HARD CONSTRAINTS
- Do NOT expose AWS credentials to the browser.
- Do NOT use NEXT_PUBLIC_ for any AWS secret or the Lambda URL.
- Do NOT call the Lambda Function URL directly from client components.
- Do NOT implement real exploitation logic in this app.
- This is a safe hackathon simulation.
- Do NOT redesign the UI. Do NOT break the dashboard or ticketing.
- Do NOT delete teammate simulator files.
- Make the smallest safe integration.

PHASE 1 — Analyze the current app first (no code yet)
Inspect: simulation setup page; target selector; attacker selector; existing
launch/scan button logic; ticket store; ticket types; ticket factory/adapter if
any; existing routes under src/app/api; existing env var usage.
Determine: where the frontend should trigger a scan; whether
/api/redteam/scan or /api/redteam/launch already exists; whether a
findings→ticket adapter exists; how tickets are currently added/upserted.
Do not implement until analysis is complete. Report findings, then proceed.

PHASE 2 — AWS signing dependencies
Check for: @aws-sdk/signature-v4, @smithy/protocol-http (or
@aws-sdk/protocol-http), @aws-sdk/credential-provider-node, @aws-crypto/sha256-js.
Install only the minimal missing packages for SigV4. Add no other AWS packages.

PHASE 3 — Environment variables (server-only)
Add backend-only vars (NONE prefixed with NEXT_PUBLIC_):
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  AWS_SESSION_TOKEN=            # optional; include if creds are temporary
  AWS_REGION=us-east-1
  LAMBDA_FUNCTION_URL=https://n23oucit2pdvxg4uqfnktj4dia0gield.lambda-url.us-east-1.on.aws/
  REDTEAM_SCAN_MODE=mock        # mock | external
  REDTEAM_SCAN_TIMEOUT_MS=300000
Only server-side route handlers read these. Create/update .env.example with
placeholder values (no real secrets).

PHASE 4 — Types
Create src/lib/redteam-scan.types.ts:
- RedTeamScanRequest { target: string; scope?: string[]; agents?: number;
  attacker_id?: string; attacker_name?: string; safe_mode?: boolean }
- RawSeverity = "critical" | "high" | "medium" | "low" | "info"   // wire format
- TicketSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" // normalized
- RedTeamFinding { title: string; severity: RawSeverity | string; persona?: string;
  vector?: string; endpoint?: string; evidence?: string; poc?: string;
  remediation?: string; confirmed?: boolean }
- RedTeamScanSummary { total: number; critical?: number; high?: number;
  medium?: number; low?: number }   // real Lambda sends only total+critical
- RedTeamScanResponse { ok: boolean; target?: string; mode?: string;
  summary?: RedTeamScanSummary; findings?: RedTeamFinding[]; run_id?: string;
  provider?: "mock" | "lambda"; error?: string; message?: string }

PHASE 5 — SigV4 helper (server-only)
Create src/lib/aws-sigv4.ts exporting:
  signAndSendLambdaFunctionUrl(input: {
    url: string; region: string; body: unknown; timeoutMs?: number;
  }): Promise<Response>
Requirements:
- Server-only (never imported by a client component).
- AWS SDK v3 SignatureV4 with service "lambda", sha256 = @aws-crypto/sha256-js.
- Credentials from defaultProvider() (reads env incl. AWS_SESSION_TOKEN).
- Build an HttpRequest with protocol, hostname, path, method=POST,
  headers { host, "content-type": "application/json" }, body = JSON string.
- Sign, then fetch(url, { method, headers: signed.headers, body }).
- Use AbortController with timeoutMs (default from REDTEAM_SCAN_TIMEOUT_MS).
- Never log or leak credentials.

PHASE 6 — Scan proxy route
Create src/app/api/redteam/scan/route.ts (App Router).
Add: export const runtime = "nodejs";  // AWS SDK needs Node, not Edge.
Add: export const maxDuration = 300;    // allow long waits on platforms that honor it.
Behavior:
- Accept POST RedTeamScanRequest.
- Validate: target required (400 if missing); agents defaults to 5, clamp 1..10;
  safe_mode defaults true; scope defaults to [hostFromTarget].
- If REDTEAM_SCAN_MODE === "mock": return a mock RedTeamScanResponse shaped
  EXACTLY like the real contract (lowercase severities; summary {total,critical};
  provider:"mock"; run_id set). Include ~3 findings across severities.
- If REDTEAM_SCAN_MODE === "external":
    - Require LAMBDA_FUNCTION_URL (500 if missing, generic message).
    - Build the Lambda body with the AUTHORITATIVE keys:
        { target, authorized: true, scope, mode: "llm-swarm", agents }
      (do NOT forward safe_mode/attacker_* to the Lambda; keep them for tickets).
    - Call signAndSendLambdaFunctionUrl({ url, region: AWS_REGION || "us-east-1",
      body, timeoutMs: REDTEAM_SCAN_TIMEOUT_MS }).
    - On 2xx: return Lambda JSON with provider:"lambda".
    - On non-2xx: return { ok:false, provider:"lambda", error:<status+safe msg> }.
    - On AbortError/timeout: return { ok:false, error:"scan timed out" }.
- Never include AWS credentials or signing internals in any error response.

PHASE 7 — Frontend scan service
Create src/lib/redteam-scan.service.ts:
  scanTarget(payload: RedTeamScanRequest): Promise<RedTeamScanResponse>
- POST to /api/redteam/scan with content-type application/json.
- Parse and return JSON; on network failure return { ok:false, error }.
- NEVER call the Lambda URL directly.

PHASE 8 — Simulation setup UI (reuse existing, no redesign)
- User selects/inputs target; selects attacker if a selector exists.
- Agents count input, default 5, max 10, with helper text:
  "More agents = deeper scan but slower (5 is a good default; 10 can take minutes)."
- Launch button calls scanTarget(); disable while loading; show
  "Starting red-team scan…".
- On success: show run_id (if any), summary, and a findings preview.
- On error: show a readable message.
- Keep current styling. Frontend calls ONLY POST /api/redteam/scan.

PHASE 9 — Findings → tickets adapter
Create/update src/lib/redteam-finding-to-ticket.adapter.ts:
  normalizeSeverity(raw: string): TicketSeverity   // toUpperCase; map unknown→"INFO"
  normalizeFindingToTicket(finding, context: { target; run_id?; attacker_id?;
    attacker_name? }): SecurityTicket
Mapping:
  - title = finding.title
  - severity = normalizeSeverity(finding.severity)   // handles lowercase + "info"
  - persona/matched_pattern = finding.persona ?? attacker_name
  - evidence_logs = [finding.evidence].filter(Boolean)
  - recommended_actions = [finding.remediation].filter(Boolean)
  - ai_analysis = include finding.poc + confirmed status if present
  - detection_source = "AWS Lambda Claude Red-Team Scan"
  - source = "lambda"
  - affected_endpoint/target = finding.endpoint ?? context.target
  - status: CRITICAL/HIGH → needs_review; MEDIUM/LOW/INFO → per existing convention
  - defender_action: CRITICAL/HIGH → notify_admin; MEDIUM → notify_dev; LOW/INFO → none
  - action_taken: false for review-required; true only if simulated auto-containment fits
Also: normalizeScanResponseToTickets(response, context): SecurityTicket[]
  (skip INFO findings or map to LOW, per existing ticketing convention).

PHASE 10 — Ticket store (reuse, don't rewrite)
If an add/upsert exists, reuse it. Otherwise add:
  importRedTeamFindings(response: RedTeamScanResponse, context): void
- Convert findings → SecurityTickets.
- Dedup key = title + affected target + (persona | run_id).
- If an unresolved match exists: append evidence, bump request_count if present,
  update last_seen/updated_at, add note "Ticket updated from Lambda Claude red-team scan."
- Else create new with note "Ticket created from Lambda Claude red-team scan."
Do not break existing ticket pages or rewrite the store.

PHASE 11 — Wire success → import
After scanTarget() succeeds in the setup UI:
- Show findings preview.
- Call importRedTeamFindings(...).
- Show "Scan completed and findings were added to Security Tickets."
- Link "View Security Tickets" → /security/tickets.
- Dashboard updates automatically via the store change.

PHASE 12 — Long-running requests
- Default agents = 5 (3 for the fastest demo); 10 can take several minutes.
- Set REDTEAM_SCAN_TIMEOUT_MS to comfortably exceed the chosen agent count
  (e.g. 300000 for up to 10 agents).
- HOSTING CAVEAT: a synchronous proxy that waits minutes works in local `next dev`
  and on Node hosts that honor maxDuration. On Vercel Hobby (and similar), serverless
  functions are killed at 10–60s and WILL 504 before the scan finishes. For the demo,
  run locally or on a host that allows long requests.
- Leave an explicit TODO for production async:
    POST /api/redteam/scan/start → { job_id }
    GET  /api/redteam/scan/status/:job_id
  Do not build the async system now unless one already exists.

PHASE 13 — Docs
Create docs/lambda-scan-proxy.md covering: why the browser can't call the Lambda;
the architecture diagram; required env vars; example frontend request; the exact
Lambda request body (with authorized:true and mode:"llm-swarm"); the response
shape (lowercase severities; summary only total+critical); the hosting-timeout
caveat; and security notes (keys stay server-side, no NEXT_PUBLIC_ secrets,
safe simulation only).

PHASE 14 — Validation
Run: npm run build
Mock mode (REDTEAM_SCAN_MODE=mock):
  open setup page → enter target → select attacker → agents=3 → start →
  loading state appears → mock findings render → findings import into
  /security/tickets → /dashboard metrics update → /security/tickets/[ticketId] works.
External mode (REDTEAM_SCAN_MODE=external):
  set AWS_REGION=us-east-1, LAMBDA_FUNCTION_URL, AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN if temporary) → start app →
  start scan → confirm the proxy SigV4-signs and sends authorized:true +
  mode:"llm-swarm" → Lambda responds with findings → findings import into tickets.
Final checks: no AWS keys in client bundle; no NEXT_PUBLIC_ secrets; Lambda never
called from the browser; UI not redesigned; dashboard/ticketing intact; simulator
pages preserved.
