import { Router, Request, Response } from "express";
import { importMiroFishOutput } from "../services/mirofishImport.service";
import { listPersonas, getPersona } from "../services/persona.service";

const router = Router();

/**
 * Persona routes. Import accepts raw MiroFish output (envelope or bare array)
 * and normalizes it into AttackerPersonas.
 */

// POST /api/personas/import
router.post("/import", (req: Request, res: Response) => {
  try {
    const personas = importMiroFishOutput(req.body);
    res.json({ imported: personas.length, personas });
  } catch (err) {
    res.status(400).json({ error: "Invalid MiroFish payload", detail: String(err) });
  }
});

// GET /api/personas
router.get("/", (_req: Request, res: Response) => {
  res.json(listPersonas());
});

// GET /api/personas/:persona_name
router.get("/:persona_name", (req: Request, res: Response) => {
  const persona = getPersona(req.params.persona_name);
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  res.json(persona);
});

export default router;
