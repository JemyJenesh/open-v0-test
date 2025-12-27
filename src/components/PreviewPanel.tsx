import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Folder, Eye, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreviewPanelProps {
  onElementSelect: (element: any) => void;
  selectedElement: any;
  onContextChange: (context: any) => void;
  mode: "preview" | "edit";
  onModeChange: (mode: "preview" | "edit") => void;
}

const PreviewPanel = forwardRef(({ onElementSelect, selectedElement, onContextChange, mode, onModeChange }: PreviewPanelProps, ref) => {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load the external project from environment variable or default to port 3000
  useEffect(() => {
    const targetUrl = import.meta.env.VITE_TARGET_PROJECT_URL || "http://localhost:3000";
    setIframeUrl(targetUrl);
  }, []);

  useImperativeHandle(ref, () => ({
    updateElementProperties: (element: any, properties: any) => {
      const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: "update-properties",
          elementId: element.elementId,
          properties
        }, "*");
      }
    }
  }));

  // Notify iframe of mode changes
  useEffect(() => {
    const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: "set-mode",
        mode
      }, "*");
    }
  }, [mode]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "demo-context") {
        onContextChange(event.data.context);
      } else if (event.data.type === "element-click") {
        onElementSelect(event.data.element);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onContextChange, onElementSelect]);

  const handleRefresh = () => {
    setIsLoading(true);
    const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleSelectDirectory = () => {
    toast({
      title: "Directory Selection",
      description: "This feature will allow you to select a React project directory",
    });
  };

  return (
    <div className="flex flex-col h-full bg-editor">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-panel">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectDirectory}
          className="gap-2"
        >
          <Folder className="w-4 h-4" />
          Select Directory
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <Button
            variant={mode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("preview")}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button
            variant={mode === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("edit")}
            className="gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          {mode === "preview" ? "Preview Mode" : "Edit Mode"}
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative overflow-hidden">
        {iframeUrl ? (
          <iframe
            id="preview-iframe"
            src={iframeUrl}
            className="w-full h-full border-0 bg-white"
            title="Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No Preview Active</p>
              <p className="text-sm">Select a directory to start previewing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

PreviewPanel.displayName = "PreviewPanel";

export default PreviewPanel;
