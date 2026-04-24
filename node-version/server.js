/**
 * Open V0 - Node.js/Express Backend
 * Uses OpenAI API for AI code generation
 *
 * OpenAI API:
 *   Base URL : https://api.openai.com/v1
 *   Auth     : OpenAI API key (sk-...)
 *   SDK      : openai npm package
 */

"use strict";

// Load .env file if present
try {
  require("dotenv").config();
} catch {}

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const OpenAI = require("openai").default ?? require("openai");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 54321;
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_PROJECT = path.join(ROOT_DIR, "demo-project");
const PROJECTS_DIR = path.join(ROOT_DIR, "projects");
const PROJECT_TEMPLATE_DIR = path.join(ROOT_DIR, "v0-dashboard-poc");
const PROJECT_NAME_RE = /^[a-z0-9_]+$/;

const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const LOG_PROMPTS = process.env.LOG_PROMPTS === "true";
const LOG_PROMPT_MAX_CHARS = Math.max(
  1000,
  Number(process.env.LOG_PROMPT_MAX_CHARS || 12000) || 12000,
);
const SKILLS_AUTOLOAD = process.env.SKILLS_AUTOLOAD !== "false";
const MAX_AUTO_SKILLS = Math.max(
  0,
  Number(process.env.MAX_AUTO_SKILLS || 2) || 2,
);
const MAX_SKILL_BODY_CHARS = Math.max(
  1000,
  Number(process.env.MAX_SKILL_BODY_CHARS || 4000) || 4000,
);
const MAX_SKILL_REFERENCE_CHARS = Math.max(
  500,
  Number(process.env.MAX_SKILL_REFERENCE_CHARS || 2000) || 2000,
);
const MAX_SKILL_CONTEXT_CHARS = Math.max(
  2000,
  Number(process.env.MAX_SKILL_CONTEXT_CHARS || 12000) || 12000,
);
const AUTO_FIX_AFTER_EDITS = process.env.AUTO_FIX_AFTER_EDITS !== "false";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let apiKey = process.env.OPENAI_API_KEY || "";
let projectDir = DEFAULT_PROJECT;
let devServerProcess = null;
let devServerPort = 3000;
let skillCache = {
  cacheKey: "",
  skills: [],
};

// ---------------------------------------------------------------------------
// CodeEditor tool — gives the AI read/write access to the project
// ---------------------------------------------------------------------------

const CODE_EDITOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file in the project directory. Use relative paths like 'src/App.tsx'.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "Relative path from the project root, e.g. 'src/App.tsx'",
          },
        },
        required: ["file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write or overwrite a file in the project directory. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "Relative path from the project root, e.g. 'src/components/Button.tsx'",
          },
          content: {
            type: "string",
            description: "Full file content to write",
          },
        },
        required: ["file_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List files and directories inside a directory of the project.",
      parameters: {
        type: "object",
        properties: {
          dir_path: {
            type: "string",
            description:
              "Relative path from the project root. Use '.' or '' for the project root.",
          },
        },
        required: ["dir_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the project directory.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Relative path from the project root",
          },
        },
        required: ["file_path"],
      },
    },
  },
];

/**
 * Execute a code-editor tool call and return the result as a string.
 */
function executeToolCall(toolName, args) {
  try {
    const resolveSafe = (relPath) => {
      const abs = path.resolve(projectDir, relPath);
      // Security: prevent path traversal outside project directory
      if (!abs.startsWith(path.resolve(projectDir))) {
        throw new Error("Access denied: path outside project directory");
      }
      return abs;
    };

    if (toolName === "read_file") {
      const abs = resolveSafe(args.file_path);
      if (!fs.existsSync(abs))
        return `Error: File not found: ${args.file_path}`;
      return fs.readFileSync(abs, "utf-8");
    }

    if (toolName === "write_file") {
      const abs = resolveSafe(args.file_path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, args.content, "utf-8");
      return `Successfully wrote ${args.file_path}`;
    }

    if (toolName === "list_files") {
      const abs = resolveSafe(args.dir_path || ".");
      if (!fs.existsSync(abs))
        return `Error: Directory not found: ${args.dir_path}`;
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
    }

    if (toolName === "delete_file") {
      const abs = resolveSafe(args.file_path);
      if (!fs.existsSync(abs))
        return `Error: File not found: ${args.file_path}`;
      fs.unlinkSync(abs);
      return `Successfully deleted ${args.file_path}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    return `Error executing ${toolName}: ${err.message}`;
  }
}

// ---------------------------------------------------------------------------
// Skills helpers (Claude-style auto relevance selection)
// ---------------------------------------------------------------------------

function truncateText(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

function logPromptPayload(label, payload) {
  if (!LOG_PROMPTS) return;
  try {
    const serialized = JSON.stringify(payload, null, 2);
    const out = truncateText(serialized, LOG_PROMPT_MAX_CHARS);
    console.log(
      `\n[AI PROMPT] ${new Date().toISOString()} :: ${label}\n${out}\n`,
    );
  } catch (err) {
    console.warn(`Failed to serialize prompt log for ${label}: ${err.message}`);
  }
}

function normalizeSlashes(p) {
  return p.split(path.sep).join("/");
}

function getSkillRootCandidates() {
  const candidates = [
    path.join(ROOT_DIR, ".github", "skills"),
    path.join(ROOT_DIR, ".agents", "skills"),
    path.join(ROOT_DIR, ".claude", "skills"),
    path.join(ROOT_DIR, "agents"),
  ];

  if (projectDir && path.resolve(projectDir) !== path.resolve(ROOT_DIR)) {
    candidates.push(
      path.join(projectDir, ".github", "skills"),
      path.join(projectDir, ".agents", "skills"),
      path.join(projectDir, ".claude", "skills"),
      path.join(projectDir, "agents"),
    );
  }

  const unique = new Set();
  for (const p of candidates) {
    unique.add(path.resolve(p));
  }
  return Array.from(unique).filter((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: text };
  }

  const meta = {};
  const rawMeta = match[1].split(/\r?\n/);
  for (const line of rawMeta) {
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

function getSkillReferences(skillBody, skillDir) {
  const refs = [];
  const seen = new Set();
  const re = /\[[^\]]+\]\((\.\/[^)]+)\)/g;
  let m;

  while ((m = re.exec(skillBody)) !== null) {
    const rel = m[1];
    if (seen.has(rel)) continue;
    seen.add(rel);

    const abs = path.resolve(skillDir, rel);
    if (!abs.startsWith(path.resolve(skillDir))) continue;
    if (!fs.existsSync(abs)) continue;
    if (!fs.statSync(abs).isFile()) continue;

    try {
      const content = fs.readFileSync(abs, "utf-8");
      refs.push({
        path: rel,
        content: truncateText(content, MAX_SKILL_REFERENCE_CHARS),
      });
    } catch {
      // Ignore unreadable reference files
    }
  }

  return refs;
}

function addSkillFromFile(dedup, skillFile, fallbackName) {
  try {
    const raw = fs.readFileSync(skillFile, "utf-8");
    const parsed = parseFrontmatter(raw);
    const name = String(parsed.meta.name || fallbackName).trim();
    const description = String(parsed.meta.description || "").trim();
    const body = String(parsed.body || "").trim();
    const key = name.toLowerCase();

    if (!key) return;
    if (dedup.has(key)) return;

    dedup.set(key, {
      name,
      description,
      source: skillFile,
      body: truncateText(body, MAX_SKILL_BODY_CHARS),
      references: getSkillReferences(body, path.dirname(skillFile)),
    });
  } catch {
    // Ignore malformed skills and continue
  }
}

function discoverSkills() {
  const skillRoots = getSkillRootCandidates();
  const dedup = new Map();

  for (const root of skillRoots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(root, entry.name);
      const skillFileCandidates = [
        path.join(skillDir, "SKILL.md"),
        path.join(skillDir, "skill.md"),
      ];
      const skillFile = skillFileCandidates.find((p) => fs.existsSync(p));
      if (!skillFile) continue;

      addSkillFromFile(dedup, skillFile, entry.name);
    }
  }

  // Support a standalone always-on skill file in ./agents/FLEX.md.
  const flexCandidates = [
    path.join(ROOT_DIR, "agents", "FLEX.md"),
    projectDir ? path.join(projectDir, "agents", "FLEX.md") : null,
  ].filter(Boolean);

  for (const flexFile of flexCandidates) {
    if (fs.existsSync(flexFile) && fs.statSync(flexFile).isFile()) {
      addSkillFromFile(dedup, flexFile, "flex");
    }
  }

  return Array.from(dedup.values());
}

function isFlexSkill(skill) {
  if (!skill?.source) return false;
  return path.basename(skill.source).toLowerCase() === "flex.md";
}

function getAvailableSkills() {
  const cacheKey = `${path.resolve(ROOT_DIR)}::${path.resolve(projectDir)}`;
  if (skillCache.cacheKey === cacheKey && skillCache.skills.length) {
    return skillCache.skills;
  }

  const skills = discoverSkills();
  skillCache = {
    cacheKey,
    skills,
  };
  return skills;
}

function getMessageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("\n");
}

function parseJsonObject(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract first JSON object from mixed text
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function selectRelevantSkills({
  client,
  skills,
  messages,
  contextParts,
}) {
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
      {
        role: "system",
        content: selectorPrompt,
      },
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

  logPromptPayload("skill-selection", {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: selectorPrompt,
      },
      {
        role: "user",
        content:
          `Conversation context:\n${contextParts.join("\n")}\n\n` +
          `Recent messages:\n${recentMessages || "(none)"}\n\n` +
          `Available skills:\n${skillList}`,
      },
    ],
    temperature: 0,
    stream: false,
  });

  const raw = getMessageText(selectionResponse.choices?.[0]?.message?.content);
  const parsed = parseJsonObject(raw) || {};
  const selected = Array.isArray(parsed.relevant_skills)
    ? parsed.relevant_skills
    : [];

  const byName = new Map(skills.map((s) => [s.name.toLowerCase(), s]));
  const resolved = [];
  for (const item of selected) {
    const name = String(item?.name || "")
      .trim()
      .toLowerCase();
    if (!name) continue;
    if (!byName.has(name)) continue;
    const skill = byName.get(name);
    if (!resolved.some((s) => s.name.toLowerCase() === name)) {
      resolved.push(skill);
    }
    if (resolved.length >= MAX_AUTO_SKILLS) break;
  }

  return resolved;
}

function buildSkillsPromptBlock(skills) {
  if (!skills.length) return "";

  const chunks = [];
  for (const skill of skills) {
    const skillHeader = [
      `Skill: ${skill.name}`,
      `Description: ${skill.description || "(none)"}`,
      `Source: ${normalizeSlashes(path.relative(ROOT_DIR, skill.source))}`,
    ].join("\n");

    const refs = skill.references
      .map((ref) => `Reference ${ref.path}:\n${ref.content}`)
      .join("\n\n");

    const block = [
      skillHeader,
      "Instructions:",
      skill.body || "(empty)",
      refs ? `Referenced docs:\n${refs}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    chunks.push(block);
  }

  return truncateText(chunks.join("\n\n-----\n\n"), MAX_SKILL_CONTEXT_CHARS);
}

// ---------------------------------------------------------------------------
// Project / dev-server helpers
// ---------------------------------------------------------------------------

function getProjectStatus() {
  return {
    directory: projectDir,
    dev_server_running: devServerProcess !== null,
    dev_server_port: devServerPort,
    dev_server_url: devServerProcess ? `http://localhost:${PORT}/` : null,
  };
}

function startDevServer(port = 3000) {
  stopDevServer();
  const pkgJson = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgJson)) return false;

  devServerPort = port;
  try {
    devServerProcess = spawn(
      "npm",
      ["run", "dev", "--", "--port", String(port)],
      {
        cwd: projectDir,
        stdio: "pipe",
        shell: process.platform === "win32",
      },
    );
    devServerProcess.on("exit", () => {
      devServerProcess = null;
    });
    return true;
  } catch {
    return false;
  }
}

function stopDevServer() {
  if (!devServerProcess) return;
  try {
    devServerProcess.kill();
  } catch {}
  devServerProcess = null;
}

function copyDirectoryRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function updateTemplateFilesForProject(projectRoot, projectName) {
  const extensionJsonPath = path.join(projectRoot, "extension.json");
  if (
    fs.existsSync(extensionJsonPath) &&
    fs.statSync(extensionJsonPath).isFile()
  ) {
    const raw = fs.readFileSync(extensionJsonPath, "utf-8");
    const extensionJson = JSON.parse(raw);
    if (typeof extensionJson.id === "string") {
      extensionJson.id = extensionJson.id.replace(
        /v0_dashboard_poc/g,
        projectName,
      );
    }
    fs.writeFileSync(
      extensionJsonPath,
      `${JSON.stringify(extensionJson, null, 2)}\n`,
      "utf-8",
    );
  }

  const rsbuildConfigPath = path.join(projectRoot, "rsbuild.config.ts");
  if (
    fs.existsSync(rsbuildConfigPath) &&
    fs.statSync(rsbuildConfigPath).isFile()
  ) {
    const rsbuildContent = fs.readFileSync(rsbuildConfigPath, "utf-8");
    const nextContent = rsbuildContent.replace(
      /v0_dashboard_poc/g,
      projectName,
    );
    fs.writeFileSync(rsbuildConfigPath, nextContent, "utf-8");
  }
}

function createProjectFromTemplate(projectName) {
  if (!PROJECT_NAME_RE.test(projectName)) {
    throw new Error(
      "Invalid project name. Use lowercase letters, numbers, and underscore only.",
    );
  }

  if (
    !fs.existsSync(PROJECT_TEMPLATE_DIR) ||
    !fs.statSync(PROJECT_TEMPLATE_DIR).isDirectory()
  ) {
    throw new Error("Template directory not found: v0-dashboard-poc");
  }

  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const projectPath = path.join(PROJECTS_DIR, projectName);

  if (fs.existsSync(projectPath)) {
    throw new Error(`Project already exists: ${projectName}`);
  }

  copyDirectoryRecursive(PROJECT_TEMPLATE_DIR, projectPath);
  updateTemplateFilesForProject(projectPath, projectName);

  return projectPath;
}

// ---------------------------------------------------------------------------
// EDITOR_SCRIPT — injected into every HTML response from the proxy
// ---------------------------------------------------------------------------

const EDITOR_SCRIPT = `
<script>
(function(){
  if(window.parent===window)return;
  if(window.__editorLoaded)return;
  window.__editorLoaded=true;

  let editMode=false;
  let idCounter=0;

  function sendContext(){
    window.parent.postMessage({
      type:"demo-context",
      context:{
        route:window.location.pathname,
        scrollPosition:{x:window.scrollX,y:window.scrollY},
        viewport:{width:window.innerWidth,height:window.innerHeight}
      }
    },"*");
  }

  function getCommonValues(tagName){
    const props=["fontSize","color","backgroundColor","padding","margin","width","height"];
    const counts={};
    props.forEach(p=>counts[p]=new Map());
    document.querySelectorAll(tagName.toLowerCase()).forEach(el=>{
      const s=window.getComputedStyle(el);
      props.forEach(p=>{
        const v=s[p];
        counts[p].set(v,(counts[p].get(v)||0)+1);
      });
    });
    const result={};
    props.forEach(p=>{
      const sorted=Array.from(counts[p].entries()).sort((a,b)=>{
        const aNum=parseFloat(a[0]),bNum=parseFloat(b[0]);
        if(!isNaN(aNum)&&!isNaN(bNum))return aNum-bNum;
        return a[0].localeCompare(b[0]);
      });
      result[p]=sorted.slice(0,10).map(([v,c])=>({value:v,label:c>2?v+" ("+c+"x)":v}));
    });
    return result;
  }

  document.addEventListener("click",function(e){
    if(!editMode)return;
    e.preventDefault();
    e.stopPropagation();
    const t=e.target;
    if(!t.dataset.elementId)t.dataset.elementId="el-"+(++idCounter);
    const cs=window.getComputedStyle(t);
    const rect=t.getBoundingClientRect();
    let text="";
    for(const n of t.childNodes)if(n.nodeType===3)text+=n.textContent;
    text=text.trim();
    const textContent=text||(t.children.length>0?"["+t.children.length+" children]":"");
    const commonValues=getCommonValues(t.tagName);
    window.parent.postMessage({
      type:"element-click",
      element:{
        elementId:t.dataset.elementId,
        tagName:t.tagName,
        id:t.id,
        className:t.className,
        textContent:textContent,
        rect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height},
        computedStyle:{
          color:cs.color,backgroundColor:cs.backgroundColor,fontSize:cs.fontSize,
          fontWeight:cs.fontWeight,padding:cs.padding,margin:cs.margin,
          width:cs.width,height:cs.height,display:cs.display,position:cs.position
        },
        commonValues:commonValues
      }
    },"*");
  },true);

  window.addEventListener("message",function(e){
    if(e.data.type==="set-mode"){
      editMode=e.data.mode==="edit";
      document.body.style.cursor=editMode?"crosshair":"";
    }else if(e.data.type==="update-properties"){
      const el=document.querySelector('[data-element-id="'+e.data.elementId+'"]');
      if(el){
        const p=e.data.properties;
        if(p.color)el.style.color=p.color;
        if(p.backgroundColor)el.style.backgroundColor=p.backgroundColor;
        if(p.fontSize)el.style.fontSize=p.fontSize;
        if(p.width)el.style.width=p.width;
        if(p.height)el.style.height=p.height;
        if(p.padding)el.style.padding=p.padding;
        if(p.margin)el.style.margin=p.margin;
        if(p.textContent!==undefined&&!p.textContent.startsWith("["))el.textContent=p.textContent;
      }
    }
  });

  window.addEventListener("scroll",sendContext);
  window.addEventListener("resize",sendContext);
  sendContext();

  let lastPath=window.location.pathname;
  setInterval(function(){
    if(window.location.pathname!==lastPath){
      lastPath=window.location.pathname;
      window.parent.postMessage({type:"route-changed",route:lastPath},"*");
      sendContext();
    }
  },100);
})();
</script>
`;

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ---------------------------------------------------------------------------
// API Key routes
// ---------------------------------------------------------------------------

app.get("/api-key/status", (req, res) => {
  const envKey = process.env.OPENAI_API_KEY || "";
  if (apiKey && apiKey !== envKey) {
    return res.json({ configured: true, source: "session" });
  } else if (envKey) {
    return res.json({ configured: true, source: "env" });
  }
  res.json({ configured: false, source: null });
});

app.post("/api-key", (req, res) => {
  const { api_key } = req.body;
  if (!api_key || !api_key.trim()) {
    return res.status(400).json({ error: "API key cannot be empty" });
  }
  const key = api_key.trim();
  if (!key.startsWith("sk-")) {
    return res
      .status(400)
      .json({ error: "Invalid key format. OpenAI keys start with sk-" });
  }
  apiKey = key;
  process.env.OPENAI_API_KEY = key;
  res.json({ success: true, message: "API key configured successfully" });
});

// ---------------------------------------------------------------------------
// Project routes
// ---------------------------------------------------------------------------

app.get("/project", (req, res) => {
  res.json(getProjectStatus());
});

app.post("/project", (req, res) => {
  const { directory } = req.body;
  if (
    !directory ||
    !fs.existsSync(directory) ||
    !fs.statSync(directory).isDirectory()
  ) {
    return res.status(400).json({ error: "Invalid directory path" });
  }
  const wasRunning = devServerProcess !== null;
  stopDevServer();
  projectDir = directory;
  skillCache = { cacheKey: "", skills: [] };
  if (wasRunning) {
    startDevServer(devServerPort);
    setTimeout(() => res.json(getProjectStatus()), 2000);
  } else {
    res.json(getProjectStatus());
  }
});

app.post("/project/create", (req, res) => {
  const projectName = String(req.body?.name || "").trim();
  if (!projectName) {
    return res.status(400).json({
      error:
        "Project name is required. Use lowercase letters, numbers, and underscore only.",
    });
  }

  if (!PROJECT_NAME_RE.test(projectName)) {
    return res.status(400).json({
      error:
        "Invalid project name. Use lowercase letters, numbers, and underscore only.",
    });
  }

  let newProjectDir = "";
  try {
    newProjectDir = createProjectFromTemplate(projectName);
  } catch (err) {
    return res.status(400).json({ error: err.message || String(err) });
  }

  const wasRunning = devServerProcess !== null;
  stopDevServer();
  projectDir = newProjectDir;
  skillCache = { cacheKey: "", skills: [] };

  // Detect package manager: prefer pnpm if lockfile present, else npm
  const usesPnpm = fs.existsSync(path.join(newProjectDir, "pnpm-lock.yaml"));
  const pkgManager = usesPnpm ? "pnpm" : "npm";

  // Run install then respond
  const installProc = spawn(pkgManager, ["install"], {
    cwd: newProjectDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  installProc.on("error", (err) => {
    console.error(`[project/create] install failed: ${err.message}`);
  });

  installProc.on("exit", (code) => {
    if (code !== 0) {
      console.warn(
        `[project/create] ${pkgManager} install exited with code ${code}`,
      );
    } else {
      console.log(
        `[project/create] ${pkgManager} install completed for ${projectName}`,
      );
    }

    if (wasRunning) {
      startDevServer(devServerPort);
      setTimeout(
        () =>
          res.json({
            ...getProjectStatus(),
            created: true,
            project_name: projectName,
            install_exit_code: code,
          }),
        2000,
      );
    } else {
      res.json({
        ...getProjectStatus(),
        created: true,
        project_name: projectName,
        install_exit_code: code,
      });
    }
  });
});

app.post("/project/start", (req, res) => {
  const port = req.body?.port || 3000;
  if (!startDevServer(port)) {
    return res
      .status(400)
      .json({ error: "Failed to start dev server (missing package.json?)" });
  }
  setTimeout(() => res.json(getProjectStatus()), 2000);
});

app.post("/project/stop", (req, res) => {
  stopDevServer();
  res.json(getProjectStatus());
});

// ---------------------------------------------------------------------------
// Properties route
// ---------------------------------------------------------------------------

app.post("/properties", (req, res) => {
  const { elementId, properties } = req.body;
  res.json({
    success: true,
    properties: {
      elementId,
      ...properties,
      updatedAt: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// Chat route — OpenAI API with tool calling (agentic loop)
// ---------------------------------------------------------------------------

app.post("/chat", async (req, res) => {
  const key = apiKey || process.env.OPENAI_API_KEY || "";
  if (!key) {
    return res.status(401).json({
      error:
        "OpenAI API key not configured. Set OPENAI_API_KEY in .env or via /api-key.",
    });
  }

  const { messages = [], context } = req.body;

  // Build context string
  const contextParts = [`Project directory: ${projectDir}`];
  if (context?.route) contextParts.push(`Current route: ${context.route}`);
  if (context?.viewport)
    contextParts.push(
      `Viewport: ${context.viewport.width}x${context.viewport.height}`,
    );
  if (context?.selectedElement) {
    const el = context.selectedElement;
    contextParts.push(
      `Selected element: <${el.tagName?.toLowerCase()}` +
        (el.id ? ` id="${el.id}"` : "") +
        (el.className ? ` class="${el.className}"` : "") +
        `> ${el.textContent || ""}`.trim() +
        `>`,
    );
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendChunk = (text) => {
    const data = { choices: [{ delta: { content: text }, index: 0 }] };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const client = new OpenAI({
      baseURL: OPENAI_BASE_URL,
      apiKey: key,
    });

    const availableSkills = getAvailableSkills();
    let selectedSkills = [];
    if (availableSkills.length) {
      const alwaysIncludedSkills = availableSkills.filter(isFlexSkill);
      const selectableSkills = availableSkills.filter(
        (skill) => !isFlexSkill(skill),
      );

      selectedSkills = [...alwaysIncludedSkills];

      try {
        const relevantSkills = await selectRelevantSkills({
          client,
          skills: selectableSkills,
          messages,
          contextParts,
        });

        const existing = new Set(
          selectedSkills.map((s) => s.name.toLowerCase()),
        );
        for (const skill of relevantSkills) {
          const key = skill.name.toLowerCase();
          if (!existing.has(key)) {
            selectedSkills.push(skill);
            existing.add(key);
          }
        }
      } catch (err) {
        console.warn(`Skill selection failed: ${err.message || err}`);
      }
    }

    const skillPromptBlock = buildSkillsPromptBlock(selectedSkills);

    const systemPrompt = `You are an AI developer agent helping to build React applications.
You have access to code editor tools (read_file, write_file, list_files, delete_file).
When the user asks you to make changes to the code, use these tools to read and modify files.
Use relative paths from the project root (e.g., "src/App.tsx", "src/components/Header.tsx").
  Be concise and helpful. IMPORTANT: Never echo full file contents back in your response — just summarize what you found or changed.
  Quality bar: after making code edits, perform a verification/fix pass before finalizing. Re-read files you changed and fix syntax, import, type-shape, and obvious integration issues introduced by your edits. Only provide the final response after this pass.

Context:
${contextParts.join("\n")}
${
  skillPromptBlock
    ? `\n\nAuto-selected skills (use when relevant):\n${skillPromptBlock}`
    : ""
}`;

    // Convert message history to OpenAI format
    const openaiMessages = [{ role: "system", content: systemPrompt }];
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    logPromptPayload("chat-initial", {
      model: OPENAI_MODEL,
      messages: openaiMessages,
      tools: CODE_EDITOR_TOOLS,
      tool_choice: "auto",
      stream: false,
    });

    // Agentic loop: keep calling the model until it stops using tools
    const loopMessages = [...openaiMessages];
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    let sentVisibleContent = false;
    const touchedFiles = new Set();
    let validationPassRequested = false;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      logPromptPayload(`chat-loop-iteration-${iterations}`, {
        model: OPENAI_MODEL,
        messages: loopMessages,
        tools: CODE_EDITOR_TOOLS,
        tool_choice: "auto",
        stream: false,
      });

      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: loopMessages,
        tools: CODE_EDITOR_TOOLS,
        tool_choice: "auto",
        stream: false, // We stream the final text manually below
      });

      const choice = response.choices[0];
      const assistantMsg = choice.message;

      // Add assistant message to history
      loopMessages.push(assistantMsg);

      // If the model called tools, execute them and loop
      if (
        choice.finish_reason === "tool_calls" &&
        assistantMsg.tool_calls?.length
      ) {
        const toolResults = [];
        for (const tc of assistantMsg.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {}
          if (
            tc.function.name === "write_file" ||
            tc.function.name === "delete_file"
          ) {
            const maybePath = String(args.file_path || "").trim();
            if (maybePath) touchedFiles.add(maybePath);
          }
          const result = executeToolCall(tc.function.name, args);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        loopMessages.push(...toolResults);
        // Don't stream tool invocations — continue to next iteration
        continue;
      }

      // Model finished. If files were edited, force a verification/fix pass first.
      if (
        AUTO_FIX_AFTER_EDITS &&
        touchedFiles.size > 0 &&
        !validationPassRequested
      ) {
        validationPassRequested = true;
        loopMessages.push({
          role: "user",
          content:
            "Before finalizing, run one mandatory verification pass over the files you changed: " +
            `${Array.from(touchedFiles).join(", ")}. ` +
            "Use read_file/write_file as needed to fix issues introduced by your changes (syntax, missing imports, mismatched symbols, obvious type-shape errors). " +
            "After you complete fixes, provide a concise final summary.",
        });
        continue;
      }

      // Model finished — stream the final text response word-by-word
      const finalText = assistantMsg.content || "";
      if (finalText) {
        // Simula te streaming by splitting into small chunks
        const words = finalText.split(/(\s+)/);
        for (const word of words) {
          sendChunk(word);
          sentVisibleContent = true;
          // Small yield to keep the event loop responsive
          await new Promise((r) => setImmediate(r));
        }
      } else {
        sendChunk(
          "I made code changes, but the model returned no textual summary. Please check the preview for updates.",
        );
        sentVisibleContent = true;
      }
      break;
    }

    if (!sentVisibleContent) {
      sendChunk(
        "I could not produce a response after multiple tool steps. Please try again or simplify the prompt.",
      );
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const errData = { error: err.message || String(err) };
    res.write(`data: ${JSON.stringify(errData)}\n\n`);
    res.end();
  }
});

// ---------------------------------------------------------------------------
// Catch-all proxy — forwards everything else to the target project dev server
// Injects EDITOR_SCRIPT into HTML responses (same as Python version)
// ---------------------------------------------------------------------------

app.use("/", (req, res) => {
  const targetBase = `http://localhost:${devServerPort}`;
  const targetUrl = `${targetBase}${req.url}`;

  const parsedTarget = new URL(targetUrl);
  const isHttps = parsedTarget.protocol === "https:";
  const lib = isHttps ? https : http;

  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (isHttps ? 443 : 80),
    path: parsedTarget.pathname + parsedTarget.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedTarget.host,
    },
  };

  // Remove content-length so it gets recalculated
  delete options.headers["content-length"];

  const proxyReq = lib.request(options, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || "";
    const isHtml = contentType.includes("text/html");

    if (!isHtml) {
      // Pass through non-HTML responses unchanged
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    // Collect HTML, inject editor script, send
    let body = "";
    proxyRes.setEncoding("utf-8");
    proxyRes.on("data", (chunk) => (body += chunk));
    proxyRes.on("end", () => {
      if (body.includes("</body>")) {
        body = body.replace("</body>", EDITOR_SCRIPT + "</body>");
      }
      const responseHeaders = { ...proxyRes.headers };
      delete responseHeaders["content-length"]; // length changed after injection
      responseHeaders["content-type"] = "text/html; charset=utf-8";
      res.writeHead(proxyRes.statusCode, responseHeaders);
      res.end(body);
    });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy error: ${err.message}` });
    }
  });

  // Forward request body
  req.pipe(proxyReq);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`Open V0 Node.js backend running on http://localhost:${PORT}`);
  console.log(`  AI provider : OpenAI API (${OPENAI_BASE_URL})`);
  console.log(`  Model       : ${OPENAI_MODEL}`);
  console.log(`  Project dir : ${projectDir}`);
  console.log(`  Set your API key via OPENAI_API_KEY in .env or POST /api-key`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  stopDevServer();
  server.close();
});
process.on("SIGINT", () => {
  stopDevServer();
  server.close();
  process.exit(0);
});
