import fs from "fs";
import path from "path";
import type OpenAI from "openai";
import {
  MAX_AUTO_SKILLS,
  MAX_SKILL_BODY_CHARS,
  MAX_SKILL_CONTEXT_CHARS,
  MAX_SKILL_REFERENCE_CHARS,
  OPENAI_MODEL,
  ROOT_DIR,
  SKILLS_AUTOLOAD,
} from "../config/env";
import { runtimeState } from "../state/runtimeState";
import type { SkillDefinition } from "../types";
import { truncateText } from "../utils/logging";
import { getProjectRootsForSkills } from "./projectService";

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function parseFrontmatter(text: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: text };
  }

  const meta: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body: match[2] || "" };
}

function getSkillReferences(
  skillBody: string,
  skillDir: string,
): Array<{ path: string; content: string }> {
  const refs: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();
  const re = /\[[^\]]+\]\((\.\/[^)]+)\)/g;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(skillBody)) !== null) {
    const rel = match[1];
    if (seen.has(rel)) continue;
    seen.add(rel);

    const abs = path.resolve(skillDir, rel);
    if (!abs.startsWith(path.resolve(skillDir))) continue;
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;

    try {
      const content = fs.readFileSync(abs, "utf-8");
      refs.push({
        path: rel,
        content: truncateText(content, MAX_SKILL_REFERENCE_CHARS),
      });
    } catch {
      // Ignore unreadable references.
    }
  }

  return refs;
}

function addSkillFromFile(
  dedup: Map<string, SkillDefinition>,
  skillFile: string,
  fallbackName: string,
): void {
  try {
    const raw = fs.readFileSync(skillFile, "utf-8");
    const parsed = parseFrontmatter(raw);
    const name = String(parsed.meta.name || fallbackName).trim();
    const description = String(parsed.meta.description || "").trim();
    const body = String(parsed.body || "").trim();
    const key = name.toLowerCase();

    if (!key || dedup.has(key)) return;

    dedup.set(key, {
      name,
      description,
      source: skillFile,
      body: truncateText(body, MAX_SKILL_BODY_CHARS),
      references: getSkillReferences(body, path.dirname(skillFile)),
    });
  } catch {
    // Ignore malformed skill files.
  }
}

function getSkillRootCandidates(): string[] {
  const candidates: string[] = [];
  for (const root of getProjectRootsForSkills()) {
    candidates.push(
      path.join(root, ".github", "skills"),
      path.join(root, ".agents", "skills"),
      path.join(root, ".claude", "skills"),
      path.join(root, "agents"),
    );
  }

  return Array.from(new Set(candidates.map((p) => path.resolve(p)))).filter(
    (p) => {
      try {
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    },
  );
}

function discoverSkills(): SkillDefinition[] {
  const roots = getSkillRootCandidates();
  const dedup = new Map<string, SkillDefinition>();

  for (const root of roots) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(root, entry.name);
      const candidates = [
        path.join(skillDir, "SKILL.md"),
        path.join(skillDir, "skill.md"),
      ];
      const skillFile = candidates.find((p) => fs.existsSync(p));
      if (!skillFile) continue;
      addSkillFromFile(dedup, skillFile, entry.name);
    }
  }

  const flexCandidates = getProjectRootsForSkills().map((root) =>
    path.join(root, "agents", "FLEX.md"),
  );
  for (const flexFile of flexCandidates) {
    if (fs.existsSync(flexFile) && fs.statSync(flexFile).isFile()) {
      addSkillFromFile(dedup, flexFile, "flex");
    }
  }

  return Array.from(dedup.values());
}

export function isFlexSkill(skill: SkillDefinition): boolean {
  return path.basename(skill.source).toLowerCase() === "flex.md";
}

export function getAvailableSkills(): SkillDefinition[] {
  const cacheKey = `${path.resolve(ROOT_DIR)}::${path.resolve(runtimeState.projectDir)}`;
  if (
    runtimeState.skillCache.cacheKey === cacheKey &&
    runtimeState.skillCache.skills.length
  ) {
    return runtimeState.skillCache.skills;
  }

  const skills = discoverSkills();
  runtimeState.skillCache = { cacheKey, skills };
  return skills;
}

function getMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("\n");
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function selectRelevantSkills(args: {
  client: OpenAI;
  skills: SkillDefinition[];
  messages: Array<{ role: string; content: string }>;
  contextParts: string[];
}): Promise<SkillDefinition[]> {
  const { client, skills, messages, contextParts } = args;

  if (!SKILLS_AUTOLOAD || !skills.length || MAX_AUTO_SKILLS === 0) {
    return [];
  }

  const recentMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => `${m.role}: ${String(m.content || "")}`)
    .join("\n");

  const skillList = skills
    .map((s) => `- ${s.name}: ${s.description || "No description provided."}`)
    .join("\n");

  const selectorPrompt =
    "Select the most relevant skills for this coding conversation. " +
    "Return strict JSON only with shape: " +
    '{"relevant_skills":[{"name":"skill-name","reason":"short reason"}]}. ' +
    `Choose at most ${MAX_AUTO_SKILLS} skills and only from the provided list.`;

  const selectionResponse = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: selectorPrompt },
      {
        role: "user",
        content:
          `Conversation context:\n${contextParts.join("\n")}\n\n` +
          `Recent messages:\n${recentMessages || "(none)"}\n\n` +
          `Available skills:\n${skillList}`,
      },
    ],
    stream: false,
    temperature: 0,
  });

  const raw = getMessageText(selectionResponse.choices?.[0]?.message?.content);
  const parsed = parseJsonObject(raw) || {};
  const selected = Array.isArray(parsed.relevant_skills)
    ? (parsed.relevant_skills as Array<{ name?: string }>)
    : [];

  const byName = new Map(skills.map((s) => [s.name.toLowerCase(), s]));
  const resolved: SkillDefinition[] = [];

  for (const item of selected) {
    const key = String(item?.name || "")
      .trim()
      .toLowerCase();
    if (!key) continue;

    const skill = byName.get(key);
    if (!skill) continue;

    if (!resolved.some((s) => s.name.toLowerCase() === key)) {
      resolved.push(skill);
    }
    if (resolved.length >= MAX_AUTO_SKILLS) break;
  }

  return resolved;
}

export function buildSkillsPromptBlock(skills: SkillDefinition[]): string {
  if (!skills.length) return "";

  const chunks = skills.map((skill) => {
    const skillHeader = [
      `Skill: ${skill.name}`,
      `Description: ${skill.description || "(none)"}`,
      `Source: ${normalizeSlashes(path.relative(ROOT_DIR, skill.source))}`,
    ].join("\n");

    const refs = skill.references
      .map((ref) => `Reference ${ref.path}:\n${ref.content}`)
      .join("\n\n");

    return [
      skillHeader,
      "Instructions:",
      skill.body || "(empty)",
      refs ? `Referenced docs:\n${refs}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  });

  return truncateText(chunks.join("\n\n-----\n\n"), MAX_SKILL_CONTEXT_CHARS);
}
