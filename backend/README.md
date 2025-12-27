# Backend API

Python FastAPI backend for Open V0, providing AI chat functionality via Claude.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file:
```bash
cp env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Running the Server

```bash
# From the backend directory
python main.py

# Or with auto-reload
uvicorn main:app --host 0.0.0.0 --port 54321 --reload
```

The server runs on `http://localhost:54321`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/chat` | AI chat with Claude (streaming) |
| POST | `/api/properties` | Update component properties |

### Chat Endpoint

```bash
POST /api/chat
Content-Type: application/json

{
  "messages": [{"role": "user", "content": "Add a button"}],
  "context": {
    "route": "/",
    "viewport": {"width": 1920, "height": 1080}
  }
}
```

Returns a streaming response with AI-generated code modifications.

### Properties Endpoint

```bash
POST /api/properties
Content-Type: application/json

{
  "elementId": "element-123",
  "properties": {"color": "blue", "fontSize": "16px"}
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required. Get it from [Anthropic Console](https://console.anthropic.com/) |

## Tech Stack

- **Framework**: FastAPI
- **AI**: Claude via Agentlys library
- **Server**: Uvicorn (ASGI)
- **Validation**: Pydantic
- **HTTP Client**: httpx

## Development

- Auto-reload: `uvicorn main:app --reload`
- API docs: http://localhost:54321/docs
- OpenAPI schema: http://localhost:54321/openapi.json
