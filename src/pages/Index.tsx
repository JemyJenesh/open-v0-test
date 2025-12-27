import { useState, useRef, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import PreviewPanel from "@/components/PreviewPanel";
import PropertiesPanel from "@/components/PropertiesPanel";
import ApiKeyDialog from "@/components/ApiKeyDialog";

const Index = () => {
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [demoContext, setDemoContext] = useState<any>({
    route: "/",
    scrollPosition: { x: 0, y: 0 },
    viewport: { width: 0, height: 0 },
  });
  const [mode, setMode] = useState<"preview" | "edit">("edit");
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const previewPanelRef = useRef<any>(null);
  const chatPanelRef = useRef<any>(null);

  // Check API key status on mount
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const response = await fetch("/api/api-key/status");
        if (response.ok) {
          const data = await response.json();
          setApiKeyConfigured(data.configured);
        } else {
          setApiKeyConfigured(false);
        }
      } catch (error) {
        console.error("Failed to check API key status:", error);
        setApiKeyConfigured(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    };

    checkApiKeyStatus();
  }, []);

  const handlePropertiesUpdate = (properties: any) => {
    // Send real-time updates to the preview
    if (previewPanelRef.current) {
      previewPanelRef.current.updateElementProperties(selectedElement, properties);
    }
  };

  const handlePropertiesSave = async (properties: any) => {
    // Send directly to AI chat
    if (chatPanelRef.current) {
      await chatPanelRef.current.sendPropertyUpdate(selectedElement, properties);
    }
  };

  const handleElementSelect = (element: any) => {
    // Only set selected element in edit mode
    if (mode === "edit") {
      setSelectedElement(element);
    }
  };

  // Show loading state while checking API key
  if (isCheckingApiKey) {
    return (
      <div className="flex h-screen w-full bg-editor items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* API Key Dialog */}
      <ApiKeyDialog 
        open={apiKeyConfigured === false} 
        onSuccess={() => setApiKeyConfigured(true)} 
      />

      <div className="flex h-screen w-full bg-editor overflow-hidden">
        {/* Chat Panel - Left */}
        <div className="w-96 border-r border-border flex-shrink-0">
          <ChatPanel 
            ref={chatPanelRef}
            demoContext={demoContext} 
            selectedElement={selectedElement} 
          />
        </div>

        {/* Preview Panel - Center */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PreviewPanel 
            ref={previewPanelRef}
            onElementSelect={handleElementSelect}
            selectedElement={selectedElement}
            onContextChange={setDemoContext}
            mode={mode}
            onModeChange={setMode}
          />
        </div>

        {/* Properties Panel - Right */}
        {selectedElement && (
          <div className="w-80 border-l border-border flex-shrink-0">
            <PropertiesPanel 
              element={selectedElement}
              onPropertiesUpdate={handlePropertiesUpdate}
              onPropertiesSave={handlePropertiesSave}
              onClose={() => setSelectedElement(null)}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default Index;
