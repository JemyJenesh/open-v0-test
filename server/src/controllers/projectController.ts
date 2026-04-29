import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import type { Request, Response } from "express";
import { PROJECT_NAME_RE } from "../config/env";
import {
  createProjectFromTemplate,
  getProjectStatus,
  listProjects,
  setProjectDir,
  startDevServer,
  stopDevServer,
  waitForDevServerReady,
} from "../services/projectService";
import { runtimeState } from "../state/runtimeState";

export function getProject(req: Request, res: Response): void {
  res.json(getProjectStatus());
}

export function getProjectList(req: Request, res: Response): void {
  res.json({ projects: listProjects() });
}

export async function setProject(req: Request, res: Response): Promise<void> {
  const directory = String(req.body?.directory || "").trim();
  if (
    !directory ||
    !fs.existsSync(directory) ||
    !fs.statSync(directory).isDirectory()
  ) {
    res.status(400).json({ error: "Invalid directory path" });
    return;
  }

  const wasRunning = runtimeState.devServerProcess !== null;
  stopDevServer();
  setProjectDir(directory);

  if (wasRunning) {
    startDevServer(runtimeState.devServerPort);
    await waitForDevServerReady(runtimeState.devServerPort);
    res.json(getProjectStatus());
    return;
  }

  res.json(getProjectStatus());
}

export function createProject(req: Request, res: Response): void {
  const projectName = String(req.body?.name || "").trim();
  if (!projectName) {
    res.status(400).json({
      error:
        "Project name is required. Use lowercase letters, numbers, and underscore only.",
    });
    return;
  }

  if (!PROJECT_NAME_RE.test(projectName)) {
    res.status(400).json({
      error:
        "Invalid project name. Use lowercase letters, numbers, and underscore only.",
    });
    return;
  }

  let newProjectDir = "";
  try {
    newProjectDir = createProjectFromTemplate(projectName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
    return;
  }

  const wasRunning = runtimeState.devServerProcess !== null;
  stopDevServer();
  setProjectDir(newProjectDir);

  const usesPnpm = fs.existsSync(path.join(newProjectDir, "pnpm-lock.yaml"));
  const packageManager = usesPnpm ? "pnpm" : "npm";

  const installProc = spawn(packageManager, ["install"], {
    cwd: newProjectDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  installProc.on("error", (err) => {
    console.error(`[project/create] install failed: ${err.message}`);
  });

  installProc.on("exit", async (code) => {
    if (code !== 0) {
      console.warn(
        `[project/create] ${packageManager} install exited with code ${code}`,
      );
    } else {
      console.log(
        `[project/create] ${packageManager} install completed for ${projectName}`,
      );
    }

    const sendResponse = () => {
      res.json({
        ...getProjectStatus(),
        created: true,
        project_name: projectName,
        install_exit_code: code,
      });
    };

    if (wasRunning) {
      startDevServer(runtimeState.devServerPort);
      await waitForDevServerReady(runtimeState.devServerPort);
      sendResponse();
      return;
    }

    sendResponse();
  });
}

export async function startProject(req: Request, res: Response): Promise<void> {
  const port = Number(req.body?.port || 3000);
  if (!startDevServer(port)) {
    res
      .status(400)
      .json({ error: "Failed to start dev server (missing package.json?)" });
    return;
  }

  await waitForDevServerReady(port);
  res.json(getProjectStatus());
}

export function stopProject(req: Request, res: Response): void {
  stopDevServer();
  res.json(getProjectStatus());
}

export function buildProject(req: Request, res: Response): void {
  const projectDir = runtimeState.projectDir;
  if (!projectDir || !fs.existsSync(projectDir)) {
    res.status(400).json({ error: "No project directory set." });
    return;
  }

  const artifactsDir = path.join(projectDir, "artifacts");
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(artifactsDir, { recursive: true });

  const buildProc = spawn("pnpm", ["build"], {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  let buildOutput = "";
  buildProc.stdout.on("data", (chunk) => {
    buildOutput += chunk.toString();
  });
  buildProc.stderr.on("data", (chunk) => {
    buildOutput += chunk.toString();
  });

  buildProc.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: `Build process error: ${err.message}` });
    }
  });

  buildProc.on("exit", (code) => {
    if (res.headersSent) return;

    if (code !== 0) {
      res.status(500).json({
        error: `Build failed with exit code ${code}`,
        output: buildOutput,
      });
      return;
    }

    let zipFile: string | undefined;
    try {
      zipFile = fs
        .readdirSync(artifactsDir)
        .find((file) => file.endsWith(".zip"));
    } catch {
      zipFile = undefined;
    }

    if (!zipFile) {
      res.status(500).json({
        error: "Build succeeded but no zip file found in artifacts/",
        output: buildOutput,
      });
      return;
    }

    const zipPath = path.join(artifactsDir, zipFile);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFile}"`);
    res.setHeader(
      "X-Build-Output",
      Buffer.from(buildOutput.slice(-2000)).toString("base64"),
    );

    const stream = fs.createReadStream(zipPath);
    stream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: `Failed to stream zip: ${err.message}` });
      }
    });
    stream.pipe(res);
  });
}
