import type { Request, Response } from "express";
import OpenAI from "openai";
import {
  AUTO_FIX_AFTER_EDITS,
  OPENAI_BASE_URL,
  OPENAI_MODEL,
} from "../config/env";
import {
  CODE_EDITOR_TOOLS,
  executeToolCall,
} from "../services/codeEditorService";
import {
  buildSkillsPromptBlock,
  getAvailableSkills,
  isFlexSkill,
  selectRelevantSkills,
} from "../services/skillsService";
import { runtimeState } from "../state/runtimeState";
import { logPromptPayload } from "../utils/logging";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildContextParts(context: Record<string, any> | undefined): string[] {
  const contextParts = [`Project directory: ${runtimeState.projectDir}`];
  if (context?.route) contextParts.push(`Current route: ${context.route}`);
  if (context?.viewport) {
    contextParts.push(
      `Viewport: ${context.viewport.width}x${context.viewport.height}`,
    );
  }

  if (context?.selectedElement) {
    const el = context.selectedElement;
    const selectedSummary =
      `Selected element: <${String(el.tagName || "").toLowerCase()}` +
      (el.id ? ` id="${el.id}"` : "") +
      (el.className ? ` class="${el.className}"` : "") +
      `> ${el.textContent || ""}`.trim() +
      `>`;
    contextParts.push(selectedSummary);
  }

  return contextParts;
}

export async function chat(req: Request, res: Response): Promise<void> {
  const key = runtimeState.apiKey || process.env.OPENAI_API_KEY || "";
  if (!key) {
    res.status(401).json({
      error:
        "OpenAI API key not configured. Set OPENAI_API_KEY in .env or via /api-key.",
    });
    return;
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const context = req.body?.context as Record<string, any> | undefined;
  const contextParts = buildContextParts(context);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendChunk = (text: string) => {
    const data = { choices: [{ delta: { content: text }, index: 0 }] };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const client = new OpenAI({
      baseURL: OPENAI_BASE_URL,
      apiKey: key,
    });

    const availableSkills = getAvailableSkills();
    let selectedSkills = [] as typeof availableSkills;
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
          selectedSkills.map((skill) => skill.name.toLowerCase()),
        );
        for (const skill of relevantSkills) {
          const skillKey = skill.name.toLowerCase();
          if (!existing.has(skillKey)) {
            selectedSkills.push(skill);
            existing.add(skillKey);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Skill selection failed: ${message}`);
      }
    }

    const skillPromptBlock = buildSkillsPromptBlock(selectedSkills);
    const systemPrompt = `You are an AI developer agent helping to build React applications.
You have access to code editor tools (read_file, write_file, list_files, delete_file).
When the user asks you to make changes to the code, use these tools to read and modify files.
Use relative paths from the project root (e.g., "src/App.tsx", "src/components/Header.tsx").
Be concise and helpful. IMPORTANT: Never echo full file contents back in your response - just summarize what you found or changed.
Quality bar: after making code edits, perform a verification/fix pass before finalizing. Re-read files you changed and fix syntax, import, type-shape, and obvious integration issues introduced by your edits. Only provide the final response after this pass.

Context:
${contextParts.join("\n")}${
      skillPromptBlock
        ? `\n\nAuto-selected skills (use when relevant):\n${skillPromptBlock}`
        : ""
    }`;

    const openaiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    for (const msg of messages) {
      if (msg?.role === "user" || msg?.role === "assistant") {
        openaiMessages.push({
          role: msg.role,
          content: String(msg.content || ""),
        });
      }
    }

    logPromptPayload("chat-initial", {
      model: OPENAI_MODEL,
      messages: openaiMessages,
      tools: CODE_EDITOR_TOOLS,
      tool_choice: "auto",
      stream: false,
    });

    const loopMessages: ChatMessage[] = [...openaiMessages];
    let iterations = 0;
    const maxIterations = 10;
    let sentVisibleContent = false;
    const touchedFiles = new Set<string>();
    let validationPassRequested = false;

    while (iterations < maxIterations) {
      iterations += 1;

      logPromptPayload(`chat-loop-iteration-${iterations}`, {
        model: OPENAI_MODEL,
        messages: loopMessages,
        tools: CODE_EDITOR_TOOLS,
        tool_choice: "auto",
        stream: false,
      });

      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: loopMessages as any,
        tools: CODE_EDITOR_TOOLS as any,
        tool_choice: "auto",
        stream: false,
      });

      const choice = response.choices?.[0];
      const assistantMessage = (choice?.message || {}) as ChatMessage;
      loopMessages.push(assistantMessage);

      if (
        choice?.finish_reason === "tool_calls" &&
        assistantMessage.tool_calls?.length
      ) {
        const toolResults: ChatMessage[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }

          if (
            toolCall.function.name === "write_file" ||
            toolCall.function.name === "delete_file"
          ) {
            const maybePath = String(args.file_path || "").trim();
            if (maybePath) touchedFiles.add(maybePath);
          }

          const result = executeToolCall(toolCall.function.name, args as any);
          toolResults.push({
            role: "tool",
            content: result,
            tool_calls: undefined,
          });

          (toolResults[toolResults.length - 1] as any).tool_call_id =
            toolCall.id;
        }

        loopMessages.push(...toolResults);
        continue;
      }

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

      const finalText = String(assistantMessage.content || "");
      if (finalText) {
        const words = finalText.split(/(\s+)/);
        for (const word of words) {
          sendChunk(word);
          sentVisibleContent = true;
          await delay(0);
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

    res.write("data: [DONE]\\n\\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: message })}\\n\\n`);
    res.end();
  }
}
