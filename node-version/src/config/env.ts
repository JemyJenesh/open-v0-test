import path from "path";
import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number, min: number) => {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

export const PORT = 54321;
export const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
export const DEFAULT_PROJECT = path.join(ROOT_DIR, "demo-project");
export const PROJECTS_DIR = path.join(ROOT_DIR, "projects");
export const PROJECT_TEMPLATE_DIR = path.join(ROOT_DIR, "v0-dashboard-poc");
export const PROJECT_NAME_RE = /^[a-z0-9_]+$/;

export const LLM_PROVIDER = process.env.LLM_PROVIDER || "openai";
export const LLM_BASE_URL =
  process.env.LLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://api.openai.com/v1";
export const LLM_MODEL =
  process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
export const LOG_PROMPTS = process.env.LOG_PROMPTS === "true";
export const LOG_PROMPT_MAX_CHARS = toNumber(
  process.env.LOG_PROMPT_MAX_CHARS,
  12000,
  1000,
);
export const SKILLS_AUTOLOAD = process.env.SKILLS_AUTOLOAD !== "false";
export const MAX_AUTO_SKILLS = toNumber(process.env.MAX_AUTO_SKILLS, 2, 0);
export const MAX_SKILL_BODY_CHARS = toNumber(
  process.env.MAX_SKILL_BODY_CHARS,
  4000,
  1000,
);
export const MAX_SKILL_REFERENCE_CHARS = toNumber(
  process.env.MAX_SKILL_REFERENCE_CHARS,
  2000,
  500,
);
export const MAX_SKILL_CONTEXT_CHARS = toNumber(
  process.env.MAX_SKILL_CONTEXT_CHARS,
  12000,
  2000,
);
export const AUTO_FIX_AFTER_EDITS =
  process.env.AUTO_FIX_AFTER_EDITS !== "false";
