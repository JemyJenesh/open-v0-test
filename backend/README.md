# FastAPI Backend

Python FastAPI backend for React Vision Studio.

## Setup

1. Create a virtual environment:

```bash
python -m venv venv
```

2. Activate the virtual environment:

```bash
# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create a `.env` file with your environment variables:

```bash
cp env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Running the Server

```bash
# From the backend directory
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 54321 --reload
```

The server will run on `http://localhost:54321`.

## API Endpoints

- `GET /` - Health check
- `POST /chat` - AI chat endpoint (streaming)
- `POST /properties` - Update component properties

## Development

The server runs with auto-reload enabled when using `uvicorn` with the `--reload` flag.

## Environment Variables

- `OPENAI_API_KEY` - Required for AI chat functionality (get it from https://platform.openai.com/api-keys)
