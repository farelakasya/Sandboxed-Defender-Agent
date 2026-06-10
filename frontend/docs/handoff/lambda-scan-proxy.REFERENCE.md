# Red-Team Scan — Next.js Secure Proxy (reference bundle)

Drop-in reference implementation for calling the AWS Lambda (Claude red-team
swarm) from a Next.js app **without exposing AWS credentials to the browser**.

## Why a proxy?

The Lambda Function URL uses **AWS_IAM** auth, so every request must be
**SigV4-signed**. A browser cannot sign safely (it would need AWS secret keys).
So the browser calls a **server-side Next.js API route**, which signs and forwards
to the Lambda.

```
Browser → POST /api/redteam/scan → (SigV4 sign) → Lambda Function URL → findings
```

## Where each file goes (copy into your Next.js project)

| File in this bundle | Copy to |
|---|---|
| `src/lib/aws-sigv4.ts` | `src/lib/aws-sigv4.ts` |
| `src/lib/redteam-scan.types.ts` | `src/lib/redteam-scan.types.ts` |
| `src/lib/redteam-scan.service.ts` | `src/lib/redteam-scan.service.ts` |
| `src/lib/redteam-finding-to-ticket.adapter.ts` | `src/lib/redteam-finding-to-ticket.adapter.ts` |
| `src/app/api/redteam/scan/route.ts` | `src/app/api/redteam/scan/route.ts` |
| `.env.example` | merge into your `.env.example` / `.env.local` |
| `docs/lambda-scan-proxy.md` | `docs/lambda-scan-proxy.md` |
| `PROMPT.md` | hand to your coding agent (full task spec) |

> The adapter (`redteam-finding-to-ticket.adapter.ts`) returns a **generic** ticket
> shape — adjust the field names to match your real `SecurityTicket` type.

## Install signing deps

```bash
npm i @aws-sdk/signature-v4 @smithy/protocol-http @aws-sdk/credential-provider-node @aws-crypto/sha256-js
```
(Older SDK setups: `@aws-sdk/protocol-http` instead of `@smithy/protocol-http`.)

## Configure env (server-only — never NEXT_PUBLIC_)

See `.env.example`. Start in **mock mode** (`REDTEAM_SCAN_MODE=mock`) — no AWS
needed — then switch to `external` with real credentials.

## API contract (authoritative)

**Request the proxy sends to the Lambda** (must include `authorized` + `mode`):
```json
{ "target": "http://HOST:PORT", "authorized": true,
  "scope": ["HOST:PORT"], "mode": "llm-swarm", "agents": 5 }
```

**Response:**
```json
{ "ok": true, "summary": { "total": 14, "critical": 3 },
  "findings": [ { "title","severity","persona","endpoint",
                  "evidence","poc","remediation","confirmed" } ] }
```
- `severity` is **lowercase** (`critical/high/medium/low/info`) — normalize in the adapter.
- `summary` has **only** `total` + `critical` — derive the rest from `findings`.

## ⚠️ Hosting note

A synchronous proxy that waits minutes works in local `next dev` and on Node hosts
that honor `maxDuration`. On Vercel Hobby (and similar serverless), functions are
killed at 10–60s and will 504 before a multi-agent scan finishes. For the demo,
run locally or default to `agents: 3–5`.
