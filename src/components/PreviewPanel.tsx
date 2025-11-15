import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreviewPanelProps {
  onElementSelect: (element: any) => void;
  selectedElement: any;
}

const PreviewPanel = ({ onElementSelect, selectedElement }: PreviewPanelProps) => {
  const [iframeUrl, setIframeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // For demo, we'll use the demo-app route
  useEffect(() => {
    setIframeUrl("/demo-app");
  }, []);

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
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Preview Active
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
};

export default PreviewPanel;
