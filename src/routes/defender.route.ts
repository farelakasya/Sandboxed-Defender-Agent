import { Router, Request, Response } from "express";
import {
  analyzeRecent,
  executeDefenderAction,
  getDefenderState,
} from "../services/defender.service";

const router = Router();

// POST /api/defender/analyze-recent
router.post("/analyze-recent", (req: Request, res: Response) => {
  const limit = parseInt(String(req.body?.limit ?? req.query.limit ?? "50"), 10);
  const result = analyzeRecent(Number.isFinite(limit) ? limit : 50);
  res.json(result);
});

// POST /api/defender/action
router.post("/action", (req: Request, res: Response) => {
  try {
    const action = executeDefenderAction(req.body);
    res.status(201).json(action);
  } catch (err) {
    res.status(400).json({ error: "Invalid defender action", detail: String(err) });
  }
});

// GET /api/defender/state
router.get("/state", (_req: Request, res: Response) => {
  res.json(getDefenderState());
});

export default router;
