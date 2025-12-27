import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  demoContext: any;
  selectedElement: any;
}

const ChatPanel = forwardRef(
  ({ demoContext, selectedElement }: ChatPanelProps, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async (userMessage: string) => {
      if (!userMessage.trim() || isLoading) return;

      setIsLoading(true);
      const newUserMessage: Message = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, newUserMessage]);
      setInput("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, newUserMessage],
            context: {
              route: demoContext.route,
              scrollPosition: demoContext.scrollPosition,
              viewport: demoContext.viewport,
              selectedElement: selectedElement
                ? {
                    tagName: selectedElement.tagName,
                    id: selectedElement.id,
                    className: selectedElement.className,
                    text: selectedElement.textContent?.substring(0, 100),
                  }
                : null,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = "";

        // Add empty assistant message that we'll update
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }

                  // Handle different response formats
                  const content =
                    parsed.choices?.[0]?.delta?.content ||
                    parsed.choices?.[0]?.message?.content ||
                    parsed.content ||
                    "";

                  if (content) {
                    assistantMessage += content + "\n";
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1] = {
                        role: "assistant",
                        content: assistantMessage,
                      };
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.debug("Skipping line:", line);
                }
              }
            }
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to send message",
          variant: "destructive",
        });
        // Remove the empty assistant message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages]);

    // Expose method to send property updates
    useImperativeHandle(ref, () => ({
      sendPropertyUpdate: async (element: any, properties: any) => {
        const message = `Update element properties:
Element: ${element.tagName} ${element.id ? `#${element.id}` : ""}${
          element.className ? `.${element.className.split(" ")[0]}` : ""
        }
Current text: "${element.textContent?.substring(0, 50)}"

New properties:
${
  properties.textContent !== element.textContent
    ? `- Text: "${properties.textContent}"\n`
    : ""
}${properties.color ? `- Color: ${properties.color}\n` : ""}${
          properties.backgroundColor
            ? `- Background: ${properties.backgroundColor}\n`
            : ""
        }${properties.fontSize ? `- Font size: ${properties.fontSize}\n` : ""}${
          properties.width ? `- Width: ${properties.width}\n` : ""
        }${properties.height ? `- Height: ${properties.height}\n` : ""}${
          properties.padding ? `- Padding: ${properties.padding}\n` : ""
        }${properties.margin ? `- Margin: ${properties.margin}\n` : ""}${
          properties.comment
            ? `\nAdditional instructions: ${properties.comment}`
            : ""
        }`;

        await sendMessage(message);
      },
    }));

    const handleSend = (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    };

    return (
      <div className="flex flex-col h-full bg-panel">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            AI Assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Ask me to help build your app
          </p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation to build your app</p>
              </div>
            )}
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`px-4 py-2 rounded-lg max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary-foreground animate-pulse" />
                </div>
                <div className="px-4 py-2 rounded-lg bg-secondary">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              placeholder="Describe what you want to build..."
              className="resize-none bg-secondary border-border"
              rows={3}
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input?.trim() || isLoading}
              size="icon"
              className="h-auto"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  }
);

ChatPanel.displayName = "ChatPanel";

export default ChatPanel;
