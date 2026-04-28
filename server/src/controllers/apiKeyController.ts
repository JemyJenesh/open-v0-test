import type { Request, Response } from "express";
import { runtimeState } from "../state/runtimeState";

export function getApiKeyStatus(req: Request, res: Response): void {
  const envKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
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

  if (apiKey.length < 8) {
    res
      .status(400)
      .json({ error: "Invalid key format. Please provide a valid API key." });
    return;
  }

  runtimeState.apiKey = apiKey;
  process.env.LLM_API_KEY = apiKey;
  process.env.OPENAI_API_KEY = apiKey;
  res.json({ success: true, message: "API key configured successfully" });
}
