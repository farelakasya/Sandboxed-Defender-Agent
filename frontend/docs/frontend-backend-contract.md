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

Env:

```
NEXT_PUBLIC_USE_MOCK_DATA=false          # false = backend mode, true = mock mode
DEFENDER_BACKEND_URL=http://54.84.126.64:8001   # server-only; proxy forwards here
NEXT_PUBLIC_DEFENDER_API_BASE_URL=...    # optional: browser hits backend directly (debug)
```

The backend normalizer (`tickets.backend.service.ts`) preserves:
`recommended_actions`, `recommended_fixes`, `mitigation_actions`,
`containment_status`, `analyzer_summary`, `ai_analysis`,
`developer_notification`, and `source: "agent-analyzer"`.

**Notifications are automatic.** The UI shows read-only status
(`NotificationStatusCard`): `sent | pending | failed | not_required | unknown`,
with fallback "Notification handled automatically by defender workflow." There
is no manual "Notify Developer" action.

## 2. Attacker app — external, launched via proxy

The attacker app runs red-team / fraud agents. The **browser only calls
`/api/testing/launch`** (this app's own route); that route adds the API key
server-side and forwards to the attacker app. The browser never calls the
attacker app, AWS, or Bedrock directly.

```
Browser → POST /api/testing/launch
        → (external) POST ${ATTACKER_APP_BASE_URL}/launch  (Bearer key if set)
```

Env (server-only; **keys are never `NEXT_PUBLIC_`**):

```
TESTING_AGENT_MODE=mock                 # mock | external
ATTACKER_APP_BASE_URL=                  # external mode requires this
ATTACKER_APP_API_KEY=                   # optional bearer key
# legacy fallbacks: TESTING_AGENT_BACKEND_URL, TESTING_AGENT_API_KEY
```

- **Mock mode** (`TESTING_AGENT_MODE=mock`): returns a synthetic report; no
  attacker app needed.
- **External mode** (`TESTING_AGENT_MODE=external`): requires
  `ATTACKER_APP_BASE_URL`; missing → clean JSON error, no stack trace.

## 3. Report ↔ ticket relationship

- The **attacker report** (`AttackerReport`) is the immediate launch-side
  output, rendered by `AttackerReportPanel`. It does **not** create tickets.
- The **defender ticket** is the source-of-truth defender output from the
  defender backend DB.
- Linking happens when the attacker app / defender backend supplies
  `mapped_ticket_id`, `linked_ticket_ids`, or run-correlation fields. The
  correlation seam lives in `report-ticket-correlation.ts`
  (`getLinkedTicketIdsFromReport`, `findPotentialTicketsForReport`,
  `getReportTicketLinkStatus`). Until a link exists the panel shows:
  "No linked defender ticket yet. Tickets will appear once the defender backend
  records the verdict."

## 4. Async run status (not yet implemented)

External async runs currently show "Run started. Waiting for attacker report or
defender verdicts." Polling is **not** implemented because no attacker-app
status endpoint is confirmed. `attacker-run-status.types.ts` defines the generic
shape (and `getRunStatusUrl`) to consume a poll URL **if** the attacker app
returns one — we do not guess endpoint names.
