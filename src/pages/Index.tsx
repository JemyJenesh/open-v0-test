import { useState, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import PreviewPanel from "@/components/PreviewPanel";

const Index = () => {
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [demoContext, setDemoContext] = useState<any>({
    route: "/",
    scrollPosition: { x: 0, y: 0 },
    viewport: { width: 0, height: 0 },
  });
  const chatPanelRef = useRef<any>(null);

  const handleElementSelect = (element: any) => {
    setSelectedElement(element);
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
          onElementSelect={handleElementSelect}
          onContextChange={setDemoContext}
        />
      </div>
    </div>
  );
};

export default Index;
