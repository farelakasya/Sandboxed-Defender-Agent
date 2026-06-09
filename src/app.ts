import express, { Application, Request, Response } from "express";
import cors from "cors";

import personasRoute from "./routes/personas.route";
import mirofishRoute from "./routes/mirofish.route";
import simulationRoute from "./routes/simulation.route";
import logsRoute from "./routes/logs.route";
import defenderRoute from "./routes/defender.route";
import incidentsRoute from "./routes/incidents.route";
import agentToolsRoute from "./routes/agentTools.route";
import { seedStore } from "./services/seed.service";

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Seed the in-memory store from mocks at boot.
  seedStore();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "sandboxed-defender-agent", simulated: true });
  });

  app.use("/api/personas", personasRoute);
  app.use("/api/mirofish", mirofishRoute);
  app.use("/api/simulation", simulationRoute);
  app.use("/api/logs", logsRoute);
  app.use("/api/defender", defenderRoute);
  app.use("/api/incidents", incidentsRoute);
  app.use("/api/agent-tools", agentToolsRoute);

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
