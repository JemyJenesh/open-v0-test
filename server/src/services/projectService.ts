import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import http from "http";
import {
  PROJECT_NAME_RE,
  PROJECTS_DIR,
  PROJECT_TEMPLATE_DIR,
  ROOT_DIR,
} from "../config/env";
import { runtimeState } from "../state/runtimeState";
import type { ProjectStatus } from "../types";

export function getProjectStatus(): ProjectStatus {
  return {
    directory: runtimeState.projectDir,
    dev_server_running: runtimeState.devServerProcess !== null,
    dev_server_port: runtimeState.devServerPort,
    dev_server_url: runtimeState.devServerProcess
      ? `http://localhost:${runtimeState.devServerPort}/`
      : null,
  };
}

function isReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host,
        port,
        method: "GET",
        path: "/",
        timeout: 1500,
      },
      () => {
        resolve(true);
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => {
      resolve(false);
    });

    req.end();
  });
}

export async function waitForDevServerReady(
  port: number,
  timeoutMs = 45000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isReachable("127.0.0.1", port)) {
      return true;
    }

    if (await isReachable("localhost", port)) {
      return true;
    }

    if (!runtimeState.devServerProcess) {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

export function stopDevServer(): void {
  const proc = runtimeState.devServerProcess;
  if (!proc) return;

  const pid = proc.pid;

  try {
    if (process.platform === "win32" && pid) {
      // Kill npm and all child processes (vite/node) on Windows.
      spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
        stdio: "ignore",
        shell: true,
      });
    } else if (pid) {
      proc.kill("SIGTERM");
    }

    console.log("Dev server stopped.");
  } catch {
    // Ignore kill errors during shutdown.
    console.error("Error stopping dev server.");
  } finally {
    runtimeState.devServerProcess = null;
  }
}

export function startDevServer(port = 3000): boolean {
  stopDevServer();
  const pkgJson = path.join(runtimeState.projectDir, "package.json");
  if (!fs.existsSync(pkgJson)) return false;

  runtimeState.devServerPort = port;
  try {
    runtimeState.devServerProcess = spawn(
      "npm",
      ["run", "dev", "--", "--port", String(port)],
      {
        cwd: runtimeState.projectDir,
        stdio: "pipe",
        shell: process.platform === "win32",
      },
    );

    runtimeState.devServerProcess.on("exit", () => {
      runtimeState.devServerProcess = null;
    });

    return true;
  } catch {
    return false;
  }
}

export function setProjectDir(directory: string): void {
  runtimeState.projectDir = directory;
  runtimeState.skillCache = { cacheKey: "", skills: [] };
}

export function listProjects(): Array<{ name: string; directory: string }> {
  if (
    !fs.existsSync(PROJECTS_DIR) ||
    !fs.statSync(PROJECTS_DIR).isDirectory()
  ) {
    return [];
  }

  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      directory: path.join(PROJECTS_DIR, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function copyDirectoryRecursive(srcDir: string, destDir: string): void {
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

function updateTemplateFilesForProject(
  projectRoot: string,
  projectName: string,
): void {
  const extensionJsonPath = path.join(projectRoot, "extension.json");
  if (
    fs.existsSync(extensionJsonPath) &&
    fs.statSync(extensionJsonPath).isFile()
  ) {
    const raw = fs.readFileSync(extensionJsonPath, "utf-8");
    fs.writeFileSync(
      extensionJsonPath,
      raw.replace(/v0_dashboard_poc/g, projectName),
      "utf-8",
    );
  }

  const rsbuildConfigPath = path.join(projectRoot, "rsbuild.config.ts");
  if (
    fs.existsSync(rsbuildConfigPath) &&
    fs.statSync(rsbuildConfigPath).isFile()
  ) {
    const content = fs.readFileSync(rsbuildConfigPath, "utf-8");
    fs.writeFileSync(
      rsbuildConfigPath,
      content.replace(/v0_dashboard_poc/g, projectName),
      "utf-8",
    );
  }
}

export function createProjectFromTemplate(projectName: string): string {
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

export function getProjectRootsForSkills(): string[] {
  const roots = [ROOT_DIR];
  if (path.resolve(runtimeState.projectDir) !== path.resolve(ROOT_DIR)) {
    roots.push(runtimeState.projectDir);
  }
  return roots;
}
