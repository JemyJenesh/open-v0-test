"""
FastAPI Backend for Open V0
"""

import asyncio
import json
import os
import signal
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from agentlys import Agentlys
from agentlys_tools.code_editor import CodeEditor
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


# Project state management
class ProjectState:
    def __init__(self):
        self.root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.default_project = os.path.join(self.root, "demo-project")
        self.current_directory: str = self.default_project
        self.dev_server_process: Optional[subprocess.Popen] = None
        self.dev_server_port: int = 3000
        self.code_editor: CodeEditor = CodeEditor(directory=self.default_project)

    def set_directory(self, directory: str) -> bool:
        """Set the current project directory and reinitialize CodeEditor"""
        if not os.path.isdir(directory):
            return False
        self.current_directory = directory
        self.code_editor = CodeEditor(directory=directory)
        return True

    def start_dev_server(self, port: int = 3000) -> bool:
        """Start the dev server for the current project"""
        self.stop_dev_server()

        # Check if package.json exists
        package_json = os.path.join(self.current_directory, "package.json")
        if not os.path.exists(package_json):
            return False

        self.dev_server_port = port
        try:
            self.dev_server_process = subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", str(port)],
                cwd=self.current_directory,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if os.name != "nt" else None,
            )
            return True
        except Exception:
            return False

    def stop_dev_server(self):
        """Stop the running dev server"""
        if self.dev_server_process:
            try:
                if os.name != "nt":
                    os.killpg(os.getpgid(self.dev_server_process.pid), signal.SIGTERM)
                else:
                    self.dev_server_process.terminate()
                self.dev_server_process.wait(timeout=5)
            except Exception:
                pass
            self.dev_server_process = None

    def get_status(self) -> dict:
        """Get current project status"""
        return {
            "directory": self.current_directory,
            "dev_server_running": self.dev_server_process is not None,
            "dev_server_port": self.dev_server_port,
            "dev_server_url": f"http://localhost:{self.dev_server_port}" if self.dev_server_process else None,
        }


project_state = ProjectState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    project_state.stop_dev_server()


app = FastAPI(title="Open V0 API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class Message(BaseModel):
    role: str
    content: str


class Context(BaseModel):
    route: Optional[str] = None
    viewport: Optional[Dict[str, int]] = None
    scrollPosition: Optional[Dict[str, int]] = None
    selectedElement: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    messages: List[Message]
    context: Optional[Context] = None


class PropertiesRequest(BaseModel):
    elementId: str
    properties: Dict[str, Any]


class PropertiesResponse(BaseModel):
    success: bool
    properties: Dict[str, Any]


# Health check endpoint
@app.get("/")
async def root():
    return {"status": "ok", "message": "Open V0 API"}


# Project management endpoints
class ProjectRequest(BaseModel):
    directory: str


class DevServerRequest(BaseModel):
    port: Optional[int] = 3000


@app.get("/project")
async def get_project():
    """Get current project status"""
    return project_state.get_status()


@app.post("/project")
async def set_project(request: ProjectRequest):
    """Set the project directory"""
    if not project_state.set_directory(request.directory):
        raise HTTPException(status_code=400, detail="Invalid directory path")
    return project_state.get_status()


@app.post("/project/start")
async def start_project(request: DevServerRequest = None):
    """Start the dev server for current project"""
    port = request.port if request else 3000
    if not project_state.start_dev_server(port):
        raise HTTPException(status_code=400, detail="Failed to start dev server")
    # Wait a bit for server to start
    await asyncio.sleep(2)
    return project_state.get_status()


@app.post("/project/stop")
async def stop_project():
    """Stop the dev server"""
    project_state.stop_dev_server()
    return project_state.get_status()


# Chat endpoint
@app.post("/chat")
async def chat(request: ChatRequest):
    """
    AI chat endpoint using Agentlys with CodeEditor tool
    """
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500, detail="ANTHROPIC_API_KEY is not configured"
        )

    # Build context information
    context_data = {
        "project_directory": project_state.current_directory,
        "route": request.context.route if request.context else "unknown",
    }

    if request.context:
        if request.context.viewport:
            context_data["viewport"] = request.context.viewport
        if request.context.scrollPosition:
            context_data["scroll_position"] = request.context.scrollPosition
        if request.context.selectedElement:
            context_data["selected_element"] = request.context.selectedElement

    instruction = """You are an AI developer agent helping to build React applications.
You have access to a code editor tool that allows you to read, write, and modify files.
When the user asks you to make changes to the code, use the code_editor tool to do so.
Use relative paths from the project directory (e.g., "src/App.tsx", "src/components/Header.tsx").
Be concise and helpful in your responses."""

    # Build the conversation from message history
    conversation = ""
    for msg in request.messages:
        if msg.role == "user":
            conversation += f"User: {msg.content}\n"
        elif msg.role == "assistant":
            conversation += f"Assistant: {msg.content}\n"

    # Stream response from Agentlys using async API
    async def generate():
        try:
            agent = Agentlys(
                instruction=instruction,
                provider="anthropic",
                model="claude-opus-4-5",
                name="Developer",
                context=json.dumps(context_data),
            )
            agent.add_tool(project_state.code_editor)

            async for msg in agent.run_conversation_async(conversation):
                content = (
                    msg.content.to_string()
                    if hasattr(msg.content, "to_string")
                    else str(msg.content)
                )

                response_data = {
                    "choices": [
                        {
                            "delta": {"content": content},
                            "index": 0,
                        }
                    ]
                }
                yield f"data: {json.dumps(response_data)}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Properties endpoint
@app.post("/properties", response_model=PropertiesResponse)
async def update_properties(request: PropertiesRequest):
    """
    Handle component property updates
    """
    try:
        print(
            f"Received properties update: elementId={request.elementId}, properties={request.properties}"
        )

        # In a real implementation, this would:
        # 1. Parse the element location in the code
        # 2. Update the actual file with new properties
        # 3. Trigger a hot reload

        # For now, we just log and return success
        updated_properties = {
            "elementId": request.elementId,
            **request.properties,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }

        return PropertiesResponse(success=True, properties=updated_properties)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=54321)
