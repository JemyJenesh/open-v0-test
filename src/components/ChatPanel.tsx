import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  demoContext: any;
  selectedElement: any;
}

const ChatPanel = forwardRef(({ demoContext, selectedElement }: ChatPanelProps, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Expose method to send property updates
  useImperativeHandle(ref, () => ({
    sendPropertyUpdate: async (element: any, properties: any) => {
      const message = `Update element properties:
Element: ${element.tagName} ${element.id ? `#${element.id}` : ''}${element.className ? `.${element.className.split(' ')[0]}` : ''}
Current text: "${element.textContent?.substring(0, 50)}"

New properties:
${properties.textContent !== element.textContent ? `- Text: "${properties.textContent}"\n` : ''}${properties.color ? `- Color: ${properties.color}\n` : ''}${properties.backgroundColor ? `- Background: ${properties.backgroundColor}\n` : ''}${properties.fontSize ? `- Font size: ${properties.fontSize}\n` : ''}${properties.width ? `- Width: ${properties.width}\n` : ''}${properties.height ? `- Height: ${properties.height}\n` : ''}${properties.padding ? `- Padding: ${properties.padding}\n` : ''}${properties.margin ? `- Margin: ${properties.margin}\n` : ''}${properties.comment ? `\nAdditional instructions: ${properties.comment}` : ''}`;
      
      // Send immediately instead of just setting input
      const userMessage: Message = { role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke("chat", {
          body: { 
            messages: [...messages, userMessage],
            context: {
              route: demoContext.route,
              scrollPosition: demoContext.scrollPosition,
              viewport: demoContext.viewport,
              selectedElement: element ? {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                text: element.textContent?.substring(0, 100),
              } : null,
            }
          },
        });

        if (error) throw error;

        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } catch (error: any) {
        console.error("Chat error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to send message",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  }));

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { 
          messages: [...messages, userMessage],
          context: {
            route: demoContext.route,
            scrollPosition: demoContext.scrollPosition,
            viewport: demoContext.viewport,
            selectedElement: selectedElement ? {
              tagName: selectedElement.tagName,
              id: selectedElement.id,
              className: selectedElement.className,
              text: selectedElement.textContent?.substring(0, 100),
            } : null,
          }
        },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
        <p className="text-sm text-muted-foreground">Ask me to help build your app</p>
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
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
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
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to build..."
            className="resize-none bg-secondary border-border"
            rows={3}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-auto"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

ChatPanel.displayName = "ChatPanel";

export default ChatPanel;
