import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  RefreshCw,
  Folder,
  Eye,
  Square,
  Loader2,
  Plus,
  Hammer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreviewPanelProps {
  onElementSelect: (element: any) => void;
  selectedElement: any;
  onContextChange: (context: any) => void;
  mode: "preview" | "edit";
  onModeChange: (mode: "preview" | "edit") => void;
}

interface ProjectStatus {
  directory: string;
  dev_server_running: boolean;
  dev_server_port: number;
  dev_server_url: string | null;
}

const PreviewPanel = forwardRef(
  (
    {
      onElementSelect,
      selectedElement,
      onContextChange,
      mode,
      onModeChange,
    }: PreviewPanelProps,
    ref,
  ) => {
    const [iframeUrl, setIframeUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [directoryInput, setDirectoryInput] = useState("");
    const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(
      null,
    );
    const [isStartingServer, setIsStartingServer] = useState(false);
    const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const { toast } = useToast();

    // Fetch project status on mount
    useEffect(() => {
      fetchProjectStatus();
    }, []);

    const fetchProjectStatus = async () => {
      try {
        const response = await fetch("/api/project");
        if (response.ok) {
          const status = await response.json();
          setProjectStatus(status);
          setDirectoryInput(status.directory);
          if (status.dev_server_url) {
            setIframeUrl(status.dev_server_url);
          }
        }
      } catch (error) {
        // Backend not available
        console.error("Failed to fetch project status:", error);
      }
    };

    useImperativeHandle(ref, () => ({
      updateElementProperties: (element: any, properties: any) => {
        const iframe = document.getElementById(
          "preview-iframe",
        ) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "update-properties",
              elementId: element.elementId,
              properties,
            },
            "*",
          );
        }
      },
    }));

    // Notify iframe of mode changes
    useEffect(() => {
      const iframe = document.getElementById(
        "preview-iframe",
      ) as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: "set-mode",
            mode,
          },
          "*",
        );
      }
    }, [mode]);

    // Listen for messages from the iframe
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === "demo-context") {
          onContextChange(event.data.context);
        } else if (event.data.type === "element-click") {
          onElementSelect(event.data.element);
        } else if (event.data.type === "route-changed") {
          // Clear selected element when navigating to a new page
          onElementSelect(null);
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [onContextChange, onElementSelect]);

    const handleRefresh = () => {
      setIsLoading(true);
      const iframe = document.getElementById(
        "preview-iframe",
      ) as HTMLIFrameElement;
      if (iframe) {
        iframe.src = iframe.src;
        setTimeout(() => setIsLoading(false), 500);
      }
    };

    const handleSelectDirectory = () => {
      setIsDialogOpen(true);
    };

    const handleSetDirectory = async () => {
      if (!directoryInput.trim()) return;

      try {
        const response = await fetch("/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: directoryInput }),
        });

        if (!response.ok) {
          throw new Error("Invalid directory path");
        }

        const status = await response.json();
        setProjectStatus(status);
        setIsDialogOpen(false);

        // Update iframe URL if dev server is running (with cache bust to force reload)
        if (status.dev_server_url) {
          setIframeUrl(`${status.dev_server_url}?t=${Date.now()}`);
        }

        toast({
          title: "Directory Set",
          description: `Project: ${status.directory.split("/").pop()}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to set directory",
          variant: "destructive",
        });
      }
    };

    const handleStartServer = async () => {
      setIsStartingServer(true);
      try {
        const response = await fetch("/api/project/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ port: 3000 }),
        });

        if (!response.ok) {
          throw new Error("Failed to start dev server");
        }

        const status = await response.json();
        setProjectStatus(status);

        if (status.dev_server_url) {
          setIframeUrl(status.dev_server_url);
        }

        toast({
          title: "Server Started",
          description: "Editor integration active",
        });
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to start server",
          variant: "destructive",
        });
      } finally {
        setIsStartingServer(false);
      }
    };

    const handleCreateProject = async () => {
      const name = newProjectName.trim();
      if (!name) return;
      if (!/^[a-z0-9_]+$/.test(name)) {
        toast({
          title: "Invalid Name",
          description: "Use lowercase letters, numbers, and underscore only.",
          variant: "destructive",
        });
        return;
      }

      setIsCreatingProject(true);
      try {
        const response = await fetch("/api/project/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to create project");
        }

        setProjectStatus(data);
        setDirectoryInput(data.directory);
        setIsNewProjectDialogOpen(false);
        setNewProjectName("");

        toast({
          title: "Project Created",
          description: `Project "${name}" created at ${data.directory}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to create project",
          variant: "destructive",
        });
      } finally {
        setIsCreatingProject(false);
      }
    };

    const handleBuild = async () => {
      setIsBuilding(true);
      try {
        const response = await fetch("/api/project/build", { method: "POST" });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Build failed");
        }
        const blob = await response.blob();
        const zipName =
          response.headers
            .get("Content-Disposition")
            ?.match(/filename="(.+?)"/)?.[1] ?? "build.zip";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Build Complete",
          description: `Downloaded ${zipName}`,
        });
      } catch (error) {
        toast({
          title: "Build Failed",
          description: error instanceof Error ? error.message : "Build failed",
          variant: "destructive",
        });
      } finally {
        setIsBuilding(false);
      }
    };

    const handleStopServer = async () => {
      try {
        const response = await fetch("/api/project/stop", {
          method: "POST",
        });

        if (response.ok) {
          const status = await response.json();
          setProjectStatus(status);
          setIframeUrl("");

          toast({
            title: "Server Stopped",
            description: "Dev server has been stopped",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to stop server",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="flex flex-col h-full bg-editor">
        {/* New Project Dialog */}
        <Dialog
          open={isNewProjectDialogOpen}
          onOpenChange={setIsNewProjectDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter a project name (lowercase letters, numbers, underscore
                only)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={newProjectName}
                onChange={(e) =>
                  setNewProjectName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                placeholder="my_project_name"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsNewProjectDialogOpen(false);
                  setNewProjectName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={isCreatingProject || !newProjectName.trim()}
              >
                {isCreatingProject ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Directory Selection Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Project Directory</DialogTitle>
              <DialogDescription>
                Enter the full path to your React project
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={directoryInput}
                onChange={(e) => setDirectoryInput(e.target.value)}
                placeholder="/path/to/your/react-project"
                onKeyDown={(e) => e.key === "Enter" && handleSetDirectory()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetDirectory}>Open Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-panel">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewProjectDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectDirectory}
            className="gap-2"
          >
            <Folder className="w-4 h-4" />
            {projectStatus?.directory
              ? projectStatus.directory.split("/").pop()
              : "Select Directory"}
          </Button>

          {projectStatus?.dev_server_running ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopServer}
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartServer}
              disabled={isStartingServer}
              className="gap-2"
            >
              {isStartingServer ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || !iframeUrl}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBuild}
            disabled={isBuilding || !projectStatus?.directory}
            className="gap-2"
          >
            {isBuilding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Hammer className="w-4 h-4" />
            )}
            Build
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
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${projectStatus?.dev_server_running ? "bg-green-500" : "bg-gray-400"}`}
            />
            {projectStatus?.dev_server_running
              ? `Running on :${projectStatus.dev_server_port}`
              : "Server stopped"}
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
                <p className="text-sm">
                  Select a directory to start previewing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

PreviewPanel.displayName = "PreviewPanel";

export default PreviewPanel;
