import { Router, Request, Response } from "express";
import {
  recentLogs,
  ingestRawLog,
  ingestRawLogBatch,
} from "../services/logNormalizer.service";

const router = Router();

// GET /api/logs/recent
router.get("/recent", (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  res.json(recentLogs(Number.isFinite(limit) ? limit : 50));
});

// POST /api/logs/ingest
router.post("/ingest", (req: Request, res: Response) => {
  try {
    const log = ingestRawLog(req.body);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: "Invalid log", detail: String(err) });
  }
});

// POST /api/logs/ingest-batch
router.post("/ingest-batch", (req: Request, res: Response) => {
  try {
    const body = req.body;
    const arr = Array.isArray(body) ? body : body?.logs;
    if (!Array.isArray(arr)) {
      res.status(400).json({ error: "Expected an array of logs or { logs: [...] }" });
      return;
    }
    const logs = ingestRawLogBatch(arr);
    res.status(201).json({ ingested: logs.length, logs });
  } catch (err) {
    res.status(400).json({ error: "Invalid log batch", detail: String(err) });
  }
});

export default router;
