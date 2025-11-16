"""
FastAPI Backend for React Vision Studio
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="React Vision Studio API")

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
    return {"status": "ok", "message": "React Vision Studio API"}


# Chat endpoint
@app.post("/chat")
async def chat(request: ChatRequest):
    """
    AI chat endpoint that streams responses from OpenAI API
    """
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    # Build context information
    context_info = ""
    if request.context:
        context_info = f"\n\nCurrent context:"
        context_info += f"\n- Route: {request.context.route or 'unknown'}"

        if request.context.viewport:
            width = request.context.viewport.get("width", 0)
            height = request.context.viewport.get("height", 0)
            context_info += f"\n- Viewport: {width}x{height}"

        if request.context.scrollPosition:
            x = request.context.scrollPosition.get("x", 0)
            y = request.context.scrollPosition.get("y", 0)
            context_info += f"\n- Scroll position: x:{x}, y:{y}"

        if request.context.selectedElement:
            tag_name = request.context.selectedElement.get("tagName", "")
            text = request.context.selectedElement.get("text", "")
            context_info += f"\n- Selected element: <{tag_name}>"
            if text:
                context_info += f' "{text}"'

    system_prompt = f"""You are an AI assistant helping to build React applications.
You can help users design components, write code, and provide guidance on best practices.
Be concise and helpful in your responses.{context_info}"""

    # Prepare messages for API
    messages = [
        {"role": "system", "content": system_prompt},
        *[{"role": msg.role, "content": msg.content} for msg in request.messages],
    ]

    # Stream response from OpenAI API
    async def generate():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": messages,
                        "stream": True,
                    },
                ) as response:
                    if response.status_code == 429:
                        error_data = {
                            "error": "Rate limit exceeded. Please try again later."
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                        return
                    elif response.status_code == 401:
                        error_data = {
                            "error": "Invalid API key. Please check your OPENAI_API_KEY."
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                        return
                    elif response.status_code != 200:
                        error_data = {
                            "error": f"OpenAI API error: {response.status_code}"
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                        return

                    # Stream the response chunks from OpenAI
                    async for line in response.aiter_lines():
                        if line.strip():
                            # Forward the SSE data from OpenAI API
                            if line.startswith("data: "):
                                yield f"{line}\n\n"
                            elif not line.startswith(":"):
                                # If it's not a comment line, add data: prefix
                                yield f"data: {line}\n\n"
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
