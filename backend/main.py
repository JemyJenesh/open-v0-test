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
import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


# API Key state management (in-memory, falls back to env var)
class ApiKeyState:
    def __init__(self):
        self._api_key: Optional[str] = None
    
    def get_api_key(self) -> Optional[str]:
        """Get API key from memory or environment"""
        return self._api_key or os.getenv("ANTHROPIC_API_KEY")
    
    def set_api_key(self, key: str) -> None:
        """Set API key in memory and environment (for libraries that read env directly)"""
        self._api_key = key
        os.environ["ANTHROPIC_API_KEY"] = key
    
    def is_configured(self) -> bool:
        """Check if API key is configured"""
        key = self.get_api_key()
        return bool(key and len(key) > 0)


api_key_state = ApiKeyState()


# Project state management
class ProjectState:
    def __init__(self):
        self.root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.default_project = os.path.join(self.root, "demo-project")
        self.current_directory: str = self.default_project
        self.dev_server_process: Optional[subprocess.Popen] = None
        self.dev_server_port: int = 3000
        self.code_editor: CodeEditor = CodeEditor(directory=self.default_project)

    def set_directory(self, directory: str, auto_start: bool = True) -> bool:
        """Set the current project directory and reinitialize CodeEditor"""
        if not os.path.isdir(directory):
            return False
        # Stop current dev server when changing directory
        was_running = self.dev_server_process is not None
        self.stop_dev_server()
        self.current_directory = directory
        self.code_editor = CodeEditor(directory=directory)
        # Auto-start dev server for new project if one was running
        if auto_start and was_running:
            self.start_dev_server(self.dev_server_port)
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
        # Use direct backend URL - iframe loads from here
        return {
            "directory": self.current_directory,
            "dev_server_running": self.dev_server_process is not None,
            "dev_server_port": self.dev_server_port,
            "dev_server_url": "http://localhost:54321/" if self.dev_server_process else None,
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


class ProjectRequest(BaseModel):
    directory: str


class DevServerRequest(BaseModel):
    port: Optional[int] = 3000


class ApiKeyRequest(BaseModel):
    api_key: str


class ApiKeyStatusResponse(BaseModel):
    configured: bool
    source: Optional[str] = None  # "env" or "session"


# Editor script - injected into HTML responses
EDITOR_SCRIPT = """
<script>
(function(){
  if(window.parent===window)return;
  if(window.__editorLoaded)return;
  window.__editorLoaded=true;

  let editMode=false;
  let idCounter=0;

  function sendContext(){
    window.parent.postMessage({
      type:"demo-context",
      context:{
        route:window.location.pathname,
        scrollPosition:{x:window.scrollX,y:window.scrollY},
        viewport:{width:window.innerWidth,height:window.innerHeight}
      }
    },"*");
  }

  document.addEventListener("click",function(e){
    if(!editMode)return;
    if(e.target.tagName==="A")return;
    e.preventDefault();
    e.stopPropagation();
    const t=e.target;
    if(!t.dataset.elementId)t.dataset.elementId="el-"+(++idCounter);
    const cs=window.getComputedStyle(t);
    const rect=t.getBoundingClientRect();
    let text="";
    for(const n of t.childNodes)if(n.nodeType===3)text+=n.textContent;
    window.parent.postMessage({
      type:"element-click",
      element:{
        elementId:t.dataset.elementId,
        tagName:t.tagName,
        id:t.id,
        className:t.className,
        textContent:text.trim()||t.textContent?.substring(0,100),
        rect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height},
        computedStyle:{
          color:cs.color,backgroundColor:cs.backgroundColor,fontSize:cs.fontSize,
          fontWeight:cs.fontWeight,padding:cs.padding,margin:cs.margin,
          width:cs.width,height:cs.height,display:cs.display,position:cs.position
        }
      }
    },"*");
  },true);

  window.addEventListener("message",function(e){
    if(e.data.type==="set-mode"){
      editMode=e.data.mode==="edit";
      document.body.style.cursor=editMode?"crosshair":"";
    }else if(e.data.type==="update-properties"){
      const el=document.querySelector('[data-element-id="'+e.data.elementId+'"]');
      if(el){
        const p=e.data.properties;
        if(p.color)el.style.color=p.color;
        if(p.backgroundColor)el.style.backgroundColor=p.backgroundColor;
        if(p.fontSize)el.style.fontSize=p.fontSize;
        if(p.width)el.style.width=p.width;
        if(p.height)el.style.height=p.height;
        if(p.padding)el.style.padding=p.padding;
        if(p.margin)el.style.margin=p.margin;
        if(p.textContent!==undefined)el.textContent=p.textContent;
      }
    }
  });

  window.addEventListener("scroll",sendContext);
  window.addEventListener("resize",sendContext);
  sendContext();

  let lastPath=window.location.pathname;
  setInterval(function(){
    if(window.location.pathname!==lastPath){
      lastPath=window.location.pathname;
      sendContext();
    }
  },100);
})();
</script>
"""


# ============================================================================
# API ROUTES (must be defined BEFORE the catch-all proxy)
# ============================================================================

@app.get("/api-key/status", response_model=ApiKeyStatusResponse)
async def get_api_key_status():
    """Check if API key is configured"""
    env_key = os.getenv("ANTHROPIC_API_KEY")
    session_key = api_key_state._api_key
    
    if session_key:
        return ApiKeyStatusResponse(configured=True, source="session")
    elif env_key:
        return ApiKeyStatusResponse(configured=True, source="env")
    else:
        return ApiKeyStatusResponse(configured=False, source=None)


@app.post("/api-key")
async def set_api_key(request: ApiKeyRequest):
    """Set the Anthropic API key for this session"""
    if not request.api_key or len(request.api_key.strip()) == 0:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    # Basic validation - Anthropic keys start with "sk-ant-"
    key = request.api_key.strip()
    if not key.startswith("sk-ant-"):
        raise HTTPException(status_code=400, detail="Invalid API key format. Anthropic keys start with 'sk-ant-'")
    
    api_key_state.set_api_key(key)
    return {"success": True, "message": "API key configured successfully"}


@app.get("/project")
async def get_project():
    """Get current project status"""
    return project_state.get_status()


@app.post("/project")
async def set_project(request: ProjectRequest):
    """Set the project directory"""
    was_running = project_state.dev_server_process is not None
    if not project_state.set_directory(request.directory):
        raise HTTPException(status_code=400, detail="Invalid directory path")
    # Wait for new dev server to start if it was auto-restarted
    if was_running and project_state.dev_server_process is not None:
        await asyncio.sleep(2)
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


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    AI chat endpoint using Agentlys with CodeEditor tool
    """
    ANTHROPIC_API_KEY = api_key_state.get_api_key()

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=401, detail="ANTHROPIC_API_KEY is not configured. Please set your API key."
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


@app.post("/properties", response_model=PropertiesResponse)
async def update_properties(request: PropertiesRequest):
    """
    Handle component property updates
    """
    try:
        print(
            f"Received properties update: elementId={request.elementId}, properties={request.properties}"
        )

        updated_properties = {
            "elementId": request.elementId,
            **request.properties,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }

        return PropertiesResponse(success=True, properties=updated_properties)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CATCH-ALL PROXY (must be LAST - forwards everything else to target project)
# ============================================================================

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str = ""):
    """
    Transparent proxy - forwards all requests to target project.
    Only modification: injects editor script into HTML responses.
    """
    target_url = f"http://localhost:{project_state.dev_server_port}/{path}"

    # Forward query string
    if request.url.query:
        target_url += f"?{request.url.query}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Get request body for non-GET methods
            body = None
            if request.method in ["POST", "PUT", "PATCH"]:
                body = await request.body()

            # Forward headers (except host)
            headers = {
                k: v for k, v in request.headers.items()
                if k.lower() not in ["host", "content-length"]
            }

            # Make the request
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                follow_redirects=True,
            )

            content_type = response.headers.get("content-type", "")

            # Only inject editor script into HTML responses
            if "text/html" in content_type:
                content = response.text
                if "</body>" in content:
                    content = content.replace("</body>", EDITOR_SCRIPT + "</body>")
                return Response(
                    content=content,
                    status_code=response.status_code,
                    media_type="text/html",
                )

            # Pass through all other content unchanged
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=content_type.split(";")[0] if content_type else None,
            )

        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach target: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=54321)
