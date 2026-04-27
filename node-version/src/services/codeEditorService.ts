import fs from "fs";
import path from "path";
import { runtimeState } from "../state/runtimeState";

export const CODE_EDITOR_TOOLS = [
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
] as const;

type ToolArgs = {
  file_path?: string;
  dir_path?: string;
  content?: string;
};

function resolveSafe(relPath: string): string {
  const abs = path.resolve(runtimeState.projectDir, relPath);
  if (!abs.startsWith(path.resolve(runtimeState.projectDir))) {
    throw new Error("Access denied: path outside project directory");
  }
  return abs;
}

export function executeToolCall(toolName: string, args: ToolArgs): string {
  try {
    if (toolName === "read_file") {
      const abs = resolveSafe(String(args.file_path || ""));
      if (!fs.existsSync(abs)) {
        return `Error: File not found: ${args.file_path}`;
      }
      return fs.readFileSync(abs, "utf-8");
    }

    if (toolName === "write_file") {
      const abs = resolveSafe(String(args.file_path || ""));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, String(args.content || ""), "utf-8");
      return `Successfully wrote ${args.file_path}`;
    }

    if (toolName === "list_files") {
      const abs = resolveSafe(String(args.dir_path || "."));
      if (!fs.existsSync(abs)) {
        return `Error: Directory not found: ${args.dir_path}`;
      }
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
    }

    if (toolName === "delete_file") {
      const abs = resolveSafe(String(args.file_path || ""));
      if (!fs.existsSync(abs)) {
        return `Error: File not found: ${args.file_path}`;
      }
      fs.unlinkSync(abs);
      return `Successfully deleted ${args.file_path}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error executing ${toolName}: ${message}`;
  }
}
