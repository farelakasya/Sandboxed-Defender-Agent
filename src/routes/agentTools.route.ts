import { Router, Request, Response } from "express";
import { listPersonas, getPersona } from "../services/persona.service";
import { listEndpoints, simulateRequest } from "../services/simulation.service";
import { recentLogs, getLogById } from "../services/logNormalizer.service";
import { classifyLog } from "../services/classifierFallback.service";
import { createIncident } from "../services/incident.service";
import {
  executeDefenderAction,
  getDefenderState,
} from "../services/defender.service";
import { LogEvent, LogEventSchema } from "../contracts/log.schema";

const router = Router();

/**
 * Tool-friendly endpoints consumed by Bedrock Agent Action Groups. These are
 * deterministic wrappers around the services — the backend is NOT the LLM
 * agent; it only exposes callable tools.
 */

/* ----------------------------- Attacker tools ----------------------------- */

// GET /api/agent-tools/personas
router.get("/personas", (_req: Request, res: Response) => {
  res.json(listPersonas());
});

// GET /api/agent-tools/personas/:persona_name
router.get("/personas/:persona_name", (req: Request, res: Response) => {
  const persona = getPersona(req.params.persona_name);
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  res.json(persona);
});

// GET /api/agent-tools/simulation-endpoints
router.get("/simulation-endpoints", (_req: Request, res: Response) => {
  res.json(listEndpoints());
});

// POST /api/agent-tools/simulate-api-request
router.post("/simulate-api-request", (req: Request, res: Response) => {
  try {
    const result = simulateRequest(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: "Invalid simulated request", detail: String(err) });
  }
});

/* ----------------------------- Defender tools ----------------------------- */

// GET /api/agent-tools/recent-logs
router.get("/recent-logs", (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  res.json(recentLogs(Number.isFinite(limit) ? limit : 50));
});

// POST /api/agent-tools/classify-log
// Accepts either { log_id } (looked up) or { log } (inline LogEvent).
router.post("/classify-log", (req: Request, res: Response) => {
  try {
    let log: LogEvent | undefined;
    if (req.body?.log_id) {
      log = getLogById(req.body.log_id);
      if (!log) {
        res.status(404).json({ error: "Log not found" });
        return;
      }
    } else if (req.body?.log) {
      log = LogEventSchema.parse(req.body.log);
    } else {
      res.status(400).json({ error: "Provide log_id or log" });
      return;
    }
    res.json(classifyLog(log));
  } catch (err) {
    res.status(400).json({ error: "Invalid classify request", detail: String(err) });
  }
});

// POST /api/agent-tools/create-incident
router.post("/create-incident", (req: Request, res: Response) => {
  try {
    const incident = createIncident(req.body);
    res.status(201).json(incident);
  } catch (err) {
    res.status(400).json({ error: "Invalid incident", detail: String(err) });
  }
});

// POST /api/agent-tools/execute-defender-action
router.post("/execute-defender-action", (req: Request, res: Response) => {
  try {
    const action = executeDefenderAction(req.body);
    res.status(201).json(action);
  } catch (err) {
    res.status(400).json({ error: "Invalid defender action", detail: String(err) });
  }
});

// GET /api/agent-tools/defender-state
router.get("/defender-state", (_req: Request, res: Response) => {
  res.json(getDefenderState());
});

export default router;
