import { LOG_PROMPT_MAX_CHARS, LOG_PROMPTS } from "../config/env";

export function truncateText(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

export function logPromptPayload(label: string, payload: unknown): void {
  if (!LOG_PROMPTS) return;
  try {
    const serialized = JSON.stringify(payload, null, 2);
    const out = truncateText(serialized, LOG_PROMPT_MAX_CHARS);
    console.log(
      `\n[AI PROMPT] ${new Date().toISOString()} :: ${label}\n${out}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to serialize prompt log for ${label}: ${message}`);
  }
}
