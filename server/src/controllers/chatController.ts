import type { Request, Response } from "express";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { AUTO_FIX_AFTER_EDITS, LLM_MODEL } from "../config/env";
import {
  CODE_EDITOR_TOOLS,
  executeToolCall,
} from "../services/codeEditorService";
import { createChatModel } from "../services/llmService";
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
  tool_call_id?: string;
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

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toLangChainMessages(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === "system") {
      return new SystemMessage(String(message.content || ""));
    }

    if (message.role === "user") {
      return new HumanMessage(String(message.content || ""));
    }

    if (message.role === "tool") {
      return new ToolMessage({
        content: String(message.content || ""),
        tool_call_id: String(message.tool_call_id || "unknown"),
      });
    }

    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          args: parseToolArguments(toolCall.function.arguments),
        }))
      : [];

    return new AIMessage({
      content: String(message.content || ""),
      tool_calls: toolCalls,
    });
  });
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
  const key =
    runtimeState.apiKey ||
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  if (!key) {
    res.status(401).json({
      error:
        "LLM API key not configured. Set LLM_API_KEY in .env or via /api-key.",
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
    const model = createChatModel({ apiKey: key });
    const modelWithTools = model.bindTools(CODE_EDITOR_TOOLS as any, {
      tool_choice: "auto",
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
          model,
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

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    for (const msg of messages) {
      if (msg?.role === "user" || msg?.role === "assistant") {
        chatMessages.push({
          role: msg.role,
          content: String(msg.content || ""),
        });
      }
    }

    logPromptPayload("chat-initial", {
      model: LLM_MODEL,
      messages: chatMessages,
      tools: CODE_EDITOR_TOOLS,
      tool_choice: "auto",
      stream: false,
    });

    const loopMessages: ChatMessage[] = [...chatMessages];
    let iterations = 0;
    const maxIterations = 25;
    let sentVisibleContent = false;
    const touchedFiles = new Set<string>();
    let validationPassRequested = false;
    let lastAssistantText = "";

    while (iterations < maxIterations) {
      iterations += 1;

      logPromptPayload(`chat-loop-iteration-${iterations}`, {
        model: LLM_MODEL,
        messages: loopMessages,
        tools: CODE_EDITOR_TOOLS,
        tool_choice: "auto",
        stream: false,
      });

      const response = await modelWithTools.invoke(
        toLangChainMessages(loopMessages),
      );
      const responseAny = response as any;
      const toolCalls = Array.isArray(responseAny.tool_calls)
        ? responseAny.tool_calls.map((toolCall: any) => ({
            id: String(toolCall.id || ""),
            function: {
              name: String(toolCall.name || ""),
              arguments: JSON.stringify(toolCall.args || {}),
            },
          }))
        : [];

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: getMessageText(response.content),
        tool_calls: toolCalls.length ? toolCalls : undefined,
      };
      loopMessages.push(assistantMessage);
      const msgText = String(assistantMessage.content || "");
      if (msgText) lastAssistantText = msgText;

      if (assistantMessage.tool_calls?.length) {
        const toolResults: ChatMessage[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const args = parseToolArguments(toolCall.function.arguments || "{}");

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
            tool_call_id: toolCall.id,
            tool_calls: undefined,
          });
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
      if (lastAssistantText) {
        const words = lastAssistantText.split(/(\s+)/);
        for (const word of words) {
          sendChunk(word);
          await delay(0);
        }
      } else if (touchedFiles.size > 0) {
        sendChunk(
          "I made code changes across " +
            Array.from(touchedFiles).join(", ") +
            ". Please check the preview for updates.",
        );
      } else {
        sendChunk(
          "I could not produce a response after multiple tool steps. Please try again or simplify the prompt.",
        );
      }
    }

    res.write("data: [DONE]\\n\\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: message })}\\n\\n`);
    res.end();
  }
}
