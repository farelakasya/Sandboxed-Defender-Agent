import { Router, Request, Response } from "express";
import miroFishMock from "../mocks/mirofish-output.mock.json";
import { importMiroFishOutput } from "../services/mirofishImport.service";

const router = Router();

/**
 * MiroFish integration routes. In production MiroFish would POST its generated
 * personas here; for the demo we also expose the mock output and a one-click
 * import of it.
 */

// GET /api/mirofish/sample -> the raw MiroFish mock output
router.get("/sample", (_req: Request, res: Response) => {
  res.json(miroFishMock);
});

// POST /api/mirofish/import -> import an arbitrary MiroFish payload
router.post("/import", (req: Request, res: Response) => {
  try {
    const personas = importMiroFishOutput(req.body);
    res.json({ imported: personas.length, personas });
  } catch (err) {
    res.status(400).json({ error: "Invalid MiroFish payload", detail: String(err) });
  }
});

// POST /api/mirofish/import-sample -> import the bundled mock output
router.post("/import-sample", (_req: Request, res: Response) => {
  const personas = importMiroFishOutput(miroFishMock);
  res.json({ imported: personas.length, personas });
});

export default router;
