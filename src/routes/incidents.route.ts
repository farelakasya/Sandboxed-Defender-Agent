import { Router, Request, Response } from "express";
import { UpdateIncidentStatusSchema } from "../contracts/incident.schema";
import {
  listIncidents,
  getIncident,
  updateIncidentStatus,
} from "../services/incident.service";

const router = Router();

// GET /api/incidents
router.get("/", (_req: Request, res: Response) => {
  res.json(listIncidents());
});

// GET /api/incidents/:id
router.get("/:id", (req: Request, res: Response) => {
  const incident = getIncident(req.params.id);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(incident);
});

// PATCH /api/incidents/:id/status
router.patch("/:id/status", (req: Request, res: Response) => {
  const parsed = UpdateIncidentStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status", detail: parsed.error.message });
    return;
  }
  const incident = updateIncidentStatus(req.params.id, parsed.data.status);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(incident);
});

export default router;
