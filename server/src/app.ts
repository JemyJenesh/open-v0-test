import cors from "cors";
import express from "express";
import apiKeyRoutes from "./routes/apiKeyRoutes";
import chatRoutes from "./routes/chatRoutes";
import projectRoutes from "./routes/projectRoutes";
import propertiesRoutes from "./routes/propertiesRoutes";
import { proxyToProject } from "./controllers/proxyController";

export function createApp() {
  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "10mb" }));

  app.use(apiKeyRoutes);
  app.use(projectRoutes);
  app.use(propertiesRoutes);
  app.use(chatRoutes);

  // Catch-all proxy to target project dev server.
  app.use("/", proxyToProject);

  return app;
}
