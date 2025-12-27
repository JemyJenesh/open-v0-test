import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ExternalLink, AlertCircle, Loader2 } from "lucide-react";

interface ApiKeyDialogProps {
  open: boolean;
  onSuccess: () => void;
}

export function ApiKeyDialog({ open, onSuccess }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    if (!apiKey.trim().startsWith("sk-ant-")) {
      setError("Invalid API key format. Anthropic keys start with 'sk-ant-'");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to save API key");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30">
              <KeyRound className="w-6 h-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl">
              Anthropic API Key Required
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground leading-relaxed">
            Open V0 uses Claude AI to help you build applications. Enter your
            Anthropic API key to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              className="font-mono text-sm"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            <p>
              Your API key is stored in memory only and will be cleared when the
              server restarts. For persistent configuration, set the{" "}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              environment variable in{" "}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                backend/.env
              </code>
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="sm:order-1"
              onClick={() =>
                window.open("https://console.anthropic.com/", "_blank")
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Get API Key
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="sm:order-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Continue"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ApiKeyDialog;

