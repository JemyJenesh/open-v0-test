import { createApp } from "./app";
import { LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER, PORT } from "./config/env";
import { runtimeState } from "./state/runtimeState";
import { stopDevServer } from "./services/projectService";

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Open V0 Node.js backend running on http://localhost:${PORT}`);
  console.log(`  AI provider : LangChain (${LLM_PROVIDER}, ${LLM_BASE_URL})`);
  console.log(`  Model       : ${LLM_MODEL}`);
  console.log("  Set your API key via LLM_API_KEY in .env or POST /api-key");
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
