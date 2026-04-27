import type { Request, Response } from "express";
import { runtimeState } from "../state/runtimeState";

export function getApiKeyStatus(req: Request, res: Response): void {
  const envKey = process.env.OPENAI_API_KEY || "";
  if (runtimeState.apiKey && runtimeState.apiKey !== envKey) {
    res.json({ configured: true, source: "session" });
    return;
  }

  if (envKey) {
    res.json({ configured: true, source: "env" });
    return;
  }

  res.json({ configured: false, source: null });
}

export function setApiKey(req: Request, res: Response): void {
  const apiKey = String(req.body?.api_key || "").trim();
  if (!apiKey) {
    res.status(400).json({ error: "API key cannot be empty" });
    return;
  }

  if (!apiKey.startsWith("sk-")) {
    res
      .status(400)
      .json({ error: "Invalid key format. OpenAI keys start with sk-" });
    return;
  }

  runtimeState.apiKey = apiKey;
  process.env.OPENAI_API_KEY = apiKey;
  res.json({ success: true, message: "API key configured successfully" });
}
