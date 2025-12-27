import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PropertiesPanelProps {
  element: any;
  onPropertiesUpdate: (properties: any) => void;
  onPropertiesSave: (properties: any) => void;
  onClose: () => void;
}

const PropertiesPanel = ({ element, onPropertiesUpdate, onPropertiesSave, onClose }: PropertiesPanelProps) => {
  const [text, setText] = useState("");
  const [color, setColor] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [padding, setPadding] = useState("");
  const [margin, setMargin] = useState("");
  const [comment, setComment] = useState("");
  const [userHasEdited, setUserHasEdited] = useState(false);
  const { toast } = useToast();

  // Track which element we're currently editing to prevent cross-element updates
  const editingElementIdRef = useRef<string | null>(null);

  // Update form when element changes - use elementId for reliable detection
  useEffect(() => {
    if (element) {
      // Clear the editing ref first to prevent any pending updates
      editingElementIdRef.current = null;
      setUserHasEdited(false); // Reset when new element selected
      setText(element.textContent || "");
      setColor(element.computedStyle?.color || "");
      setBackgroundColor(element.computedStyle?.backgroundColor || "");
      setFontSize(element.computedStyle?.fontSize || "");
      setWidth(element.computedStyle?.width || "");
      setHeight(element.computedStyle?.height || "");
      setPadding(element.computedStyle?.padding || "");
      setMargin(element.computedStyle?.margin || "");
      setComment("");
    }
  }, [element?.elementId]);

  // Send real-time updates only after user has edited something
  useEffect(() => {
    if (!userHasEdited) return;
    // Only send updates if we're still editing the same element
    if (!editingElementIdRef.current || editingElementIdRef.current !== element?.elementId) return;

    const properties: any = {};
    // Only include textContent if it's real text (not a placeholder like "[2 children]")
    if (text && !text.startsWith('[')) properties.textContent = text;
    if (color) properties.color = color;
    if (backgroundColor) properties.backgroundColor = backgroundColor;
    if (fontSize) properties.fontSize = fontSize;
    if (width) properties.width = width;
    if (height) properties.height = height;
    if (padding) properties.padding = padding;
    if (margin) properties.margin = margin;

    onPropertiesUpdate(properties);
  }, [text, color, backgroundColor, fontSize, width, height, padding, margin, userHasEdited, element?.elementId, onPropertiesUpdate]);

  // Wrapper to mark user has edited and lock to current element
  const markEditing = () => {
    editingElementIdRef.current = element?.elementId || null;
    setUserHasEdited(true);
  };
  const handleTextChange = (value: string) => { markEditing(); setText(value); };
  const handleColorChange = (value: string) => { markEditing(); setColor(value); };
  const handleBgColorChange = (value: string) => { markEditing(); setBackgroundColor(value); };
  const handleFontSizeChange = (value: string) => { markEditing(); setFontSize(value); };
  const handleWidthChange = (value: string) => { markEditing(); setWidth(value); };
  const handleHeightChange = (value: string) => { markEditing(); setHeight(value); };
  const handlePaddingChange = (value: string) => { markEditing(); setPadding(value); };
  const handleMarginChange = (value: string) => { markEditing(); setMargin(value); };

  const handleSave = () => {
    const properties: any = {
      color,
      backgroundColor,
      fontSize,
      width,
      height,
      padding,
      margin,
      comment,
    };

    // Only include textContent if it's real text (not a placeholder)
    if (text && !text.startsWith('[')) {
      properties.textContent = text;
    }

    onPropertiesSave(properties);
    
    toast({
      title: "Sent to AI",
      description: "Property changes have been sent to the AI assistant",
    });
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Properties</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Element: {element?.tagName || "Unknown"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Properties Form */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Text Content - only show if element has direct text */}
          {text && !text.startsWith('[') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="text">Text Content</Label>
                <Textarea
                  id="text"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Enter text..."
                  className="bg-secondary border-border min-h-[100px] resize-y"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            {element?.commonValues?.color && element.commonValues.color.length > 0 ? (
              <Select value={color} onValueChange={handleColorChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.color.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: item.value }} />
                        {item.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="color"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
                placeholder="e.g., #000000, rgb(0,0,0)"
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label htmlFor="backgroundColor">Background Color</Label>
            {element?.commonValues?.backgroundColor && element.commonValues.backgroundColor.length > 0 ? (
              <Select value={backgroundColor} onValueChange={handleBgColorChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select background color" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.backgroundColor.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: item.value }} />
                        {item.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="backgroundColor"
                value={backgroundColor}
                onChange={(e) => handleBgColorChange(e.target.value)}
                placeholder="e.g., #ffffff, transparent"
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label htmlFor="fontSize">Font Size</Label>
            {element?.commonValues?.fontSize && element.commonValues.fontSize.length > 0 ? (
              <div className="space-y-2">
                <Select value={fontSize} onValueChange={handleFontSizeChange}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select font size" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {element.commonValues.fontSize.map((item: any) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fontSize && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Fine-tune ({fontSize})</Label>
                    <Slider
                      value={[parseFloat(fontSize) || 16]}
                      onValueChange={(value) => handleFontSizeChange(`${value[0]}px`)}
                      min={8}
                      max={72}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            ) : (
              <Input
                id="fontSize"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                placeholder="e.g., 16px, 1rem"
                className="bg-secondary border-border"
              />
            )}
          </div>

          <Separator />

          {/* Width */}
          <div className="space-y-2">
            <Label htmlFor="width">Width</Label>
            {element?.commonValues?.width && element.commonValues.width.length > 0 ? (
              <Select value={width} onValueChange={handleWidthChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select width" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.width.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="width"
                value={width}
                onChange={(e) => handleWidthChange(e.target.value)}
                placeholder="e.g., 100%, 300px"
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Height */}
          <div className="space-y-2">
            <Label htmlFor="height">Height</Label>
            {element?.commonValues?.height && element.commonValues.height.length > 0 ? (
              <Select value={height} onValueChange={handleHeightChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select height" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.height.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="height"
                value={height}
                onChange={(e) => handleHeightChange(e.target.value)}
                placeholder="e.g., auto, 200px"
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Padding */}
          <div className="space-y-2">
            <Label htmlFor="padding">Padding</Label>
            {element?.commonValues?.padding && element.commonValues.padding.length > 0 ? (
              <Select value={padding} onValueChange={handlePaddingChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select padding" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.padding.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="padding"
                value={padding}
                onChange={(e) => handlePaddingChange(e.target.value)}
                placeholder="e.g., 10px, 1rem 2rem"
                className="bg-secondary border-border"
              />
            )}
          </div>

          {/* Margin */}
          <div className="space-y-2">
            <Label htmlFor="margin">Margin</Label>
            {element?.commonValues?.margin && element.commonValues.margin.length > 0 ? (
              <Select value={margin} onValueChange={handleMarginChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select margin" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {element.commonValues.margin.map((item: any) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="margin"
                value={margin}
                onChange={(e) => handleMarginChange(e.target.value)}
                placeholder="e.g., 10px, 1rem auto"
                className="bg-secondary border-border"
              />
            )}
          </div>

          <Separator />

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment for AI</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add instructions for AI about this element..."
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
          Save
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Changes apply in real-time
        </p>
      </div>
    </div>
  );
};

export default PropertiesPanel;
