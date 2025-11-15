import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PropertiesPanelProps {
  element: any;
  properties: any;
  onPropertiesChange: (properties: any) => void;
}

const PropertiesPanel = ({ element, properties, onPropertiesChange }: PropertiesPanelProps) => {
  const [text, setText] = useState(properties.text || "");
  const [width, setWidth] = useState(properties.width || "");
  const [fontSize, setFontSize] = useState(properties.fontSize || "");
  const [comment, setComment] = useState(properties.comment || "");
  const { toast } = useToast();

  const handleSave = async () => {
    const newProperties = {
      text,
      width,
      fontSize,
      comment,
    };

    try {
      const { data, error } = await supabase.functions.invoke("properties", {
        body: {
          elementId: element?.id,
          properties: newProperties,
        },
      });

      if (error) throw error;

      onPropertiesChange(newProperties);
      toast({
        title: "Properties Updated",
        description: "Element properties have been saved",
      });
    } catch (error: any) {
      console.error("Error saving properties:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save properties",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Properties</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Element: {element?.tagName || "Unknown"}
        </p>
      </div>

      {/* Properties Form */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Text Content */}
          <div className="space-y-2">
            <Label htmlFor="text">Text Content</Label>
            <Input
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text..."
              className="bg-secondary border-border"
            />
          </div>

          {/* Width */}
          <div className="space-y-2">
            <Label htmlFor="width">Width</Label>
            <Input
              id="width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="e.g., 100%, 300px"
              className="bg-secondary border-border"
            />
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label htmlFor="fontSize">Font Size</Label>
            <Input
              id="fontSize"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              placeholder="e.g., 16px, 1rem"
              className="bg-secondary border-border"
            />
          </div>

          <Separator />

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment about this element..."
              className="resize-none bg-secondary border-border"
              rows={4}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border">
        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" />
          Save Properties
        </Button>
      </div>
    </div>
  );
};

export default PropertiesPanel;
