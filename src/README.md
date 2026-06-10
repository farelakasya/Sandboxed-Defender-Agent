# Legacy backend scaffold — NOT used by the frontend

This `src/` directory is an early **Express / AWS Bedrock simulation scaffold**
(action-group handlers, mock incidents/personas/nginx logs, zod contracts). It
predates the live EC2 defender backend.

**The Next.js frontend in `frontend/` does not import or build anything here.**
The frontend's source of truth is the defender backend (see
`frontend/docs/frontend-backend-contract.md`); the attacker app is reached via
`frontend/src/app/api/testing/launch`.

Kept for reference / possible collaborator Bedrock deployment. Safe to ignore
for frontend work. Not deleted or relocated to avoid disrupting teammates who
may still deploy the Bedrock pieces (`src/bedrock/`, OpenAPI specs).
