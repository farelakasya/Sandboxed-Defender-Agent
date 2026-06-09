import { Router, Request, Response } from "express";
import {
  listEndpoints,
  simulateRequest,
  simulationLogs,
} from "../services/simulation.service";

const router = Router();

// GET /api/simulation/endpoints
router.get("/endpoints", (_req: Request, res: Response) => {
  res.json(listEndpoints());
});

// POST /api/simulation/request
router.post("/request", (req: Request, res: Response) => {
  try {
    const result = simulateRequest(req.body);
    // Mirror the simulated HTTP status on the real response for realism.
    res.status(result.status_code).json(result);
  } catch (err) {
    res.status(400).json({ error: "Invalid simulated request", detail: String(err) });
  }
});

// GET /api/simulation/logs
router.get("/logs", (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  res.json(simulationLogs(Number.isFinite(limit) ? limit : 50));
});

export default router;
