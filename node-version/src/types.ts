import type { ChildProcess } from "child_process";

export type ProjectStatus = {
  directory: string;
  dev_server_running: boolean;
  dev_server_port: number;
  dev_server_url: string | null;
};

export type SkillReference = {
  path: string;
  content: string;
};

export type SkillDefinition = {
  name: string;
  description: string;
  source: string;
  body: string;
  references: SkillReference[];
};

export type SkillCache = {
  cacheKey: string;
  skills: SkillDefinition[];
};

export type RuntimeState = {
  apiKey: string;
  projectDir: string;
  devServerProcess: ChildProcess | null;
  devServerPort: number;
  skillCache: SkillCache;
};
