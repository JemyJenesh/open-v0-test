import dotenv from "dotenv";
import { createApp } from "./app";
import { OPENAI_BASE_URL, OPENAI_MODEL, PORT } from "./config/env";
import { runtimeState } from "./state/runtimeState";
import { stopDevServer } from "./services/projectService";

try {
  dotenv.config();
} catch {
  // .env is optional.
}

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Open V0 Node.js backend running on http://localhost:${PORT}`);
  console.log(`  AI provider : OpenAI API (${OPENAI_BASE_URL})`);
  console.log(`  Model       : ${OPENAI_MODEL}`);
  console.log(`  Project dir : ${runtimeState.projectDir}`);
  console.log("  Set your API key via OPENAI_API_KEY in .env or POST /api-key");
});

function shutdown(exitCode?: number) {
  stopDevServer();
  server.close(() => {
    if (typeof exitCode === "number") {
      process.exit(exitCode);
    }
  });
}

process.on("SIGTERM", () => shutdown());
process.on("SIGINT", () => shutdown(0));
