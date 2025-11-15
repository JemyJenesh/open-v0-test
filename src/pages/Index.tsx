import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import PreviewPanel from "@/components/PreviewPanel";
import PropertiesPanel from "@/components/PropertiesPanel";

const Index = () => {
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [properties, setProperties] = useState<any>({});
  const [demoContext, setDemoContext] = useState<any>({
    route: "/demo-app",
    scrollPosition: { x: 0, y: 0 },
    viewport: { width: 0, height: 0 },
  });

  return (
    <div className="flex h-screen w-full bg-editor overflow-hidden">
      {/* Chat Panel - Left */}
      <div className="w-96 border-r border-border flex-shrink-0">
        <ChatPanel demoContext={demoContext} selectedElement={selectedElement} />
      </div>

      {/* Preview Panel - Center */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PreviewPanel 
          onElementSelect={setSelectedElement}
          selectedElement={selectedElement}
          onContextChange={setDemoContext}
        />
      </div>

      {/* Properties Panel - Right */}
      {selectedElement && (
        <div className="w-80 border-l border-border flex-shrink-0">
          <PropertiesPanel 
            element={selectedElement}
            properties={properties}
            onPropertiesChange={setProperties}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
