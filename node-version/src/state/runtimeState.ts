import { DEFAULT_PROJECT } from "../config/env";
import type { RuntimeState } from "../types";

export const runtimeState: RuntimeState = {
  apiKey: process.env.OPENAI_API_KEY || "",
  projectDir: DEFAULT_PROJECT,
  devServerProcess: null,
  devServerPort: 3000,
  skillCache: {
    cacheKey: "",
    skills: [],
  },
};
