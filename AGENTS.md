# AGENTS.md

AI agent context file for Open V0. This file provides essential context for AI coding assistants.

## Project Overview

Open V0 is an open-source visual editor for frontend applications, powered by Claude AI. It features a chat interface, properties panel, and live preview for visually editing any frontend project.

## Quick Reference

- **Frontend**: React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS
- **Backend**: Python FastAPI, Claude AI via Agentlys
- **Ports**: Editor (8080), Backend (54321), Target Project (3000)

For detailed architecture and setup, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatPanel.tsx   # AI chat interface
│   ├── PreviewPanel.tsx # Component preview (iframe)
│   ├── PropertiesPanel.tsx # Visual property editor
│   └── ui/             # shadcn/ui components
├── pages/              # Route pages
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── integrations/       # Third-party integrations

backend/
├── main.py            # FastAPI application
├── requirements.txt   # Python dependencies
└── .env              # Environment variables (ANTHROPIC_API_KEY)

demo-project/          # Sample frontend for testing
```

## Code Style Guidelines

### TypeScript/React

- Functional components with hooks
- Path alias `@/*` maps to `./src/*`
- Component files use PascalCase
- Use `cn()` utility for conditional Tailwind classes

### Python

- Async/await for all I/O operations
- Pydantic models for validation
- Type hints required
- Follow PEP 8

### Naming Conventions

- Components: `PascalCase`
- Files: `PascalCase` for components, `kebab-case` for utilities
- Hooks: `useCamelCase`
- Python: `snake_case` for functions, `PascalCase` for classes

## Common Commands

```bash
# Start everything
./start-dev.sh

# Frontend only
npm run dev

# Backend only
cd backend && source venv/bin/activate && python main.py

# Add shadcn component
npx shadcn@latest add <component-name>

# Lint
npm run lint
```

## API Endpoints

| Method | Endpoint          | Description                 |
| ------ | ----------------- | --------------------------- |
| GET    | `/`               | Health check                |
| POST   | `/api/chat`       | AI chat (streaming)         |
| POST   | `/api/properties` | Update component properties |

## Key Files

- `src/App.tsx` — Main app with routing
- `src/pages/Index.tsx` — Home page with editor layout
- `src/components/ChatPanel.tsx` — AI chat interface
- `backend/main.py` — FastAPI server

## Environment Variables

### Backend `.env`

- `ANTHROPIC_API_KEY` — Required for Claude AI

## Important Notes

- Uses ESM (`"type": "module"`)
- Vite proxy: `/api/*` → `http://127.0.0.1:54321`
- All shadcn/ui components use Radix UI primitives
- Backend and frontend must run together for full functionality
