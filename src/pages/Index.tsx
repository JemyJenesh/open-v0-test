import { useState, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import PreviewPanel from "@/components/PreviewPanel";
import PropertiesPanel from "@/components/PropertiesPanel";

const Index = () => {
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [demoContext, setDemoContext] = useState<any>({
    route: "/demo-app",
    scrollPosition: { x: 0, y: 0 },
    viewport: { width: 0, height: 0 },
  });
  const [mode, setMode] = useState<"preview" | "edit">("edit");
  const previewPanelRef = useRef<any>(null);
  const chatPanelRef = useRef<any>(null);

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

  return (
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
  );
};

export default Index;
