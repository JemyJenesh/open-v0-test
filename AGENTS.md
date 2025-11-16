# AGENTS.md

## Project Overview

React Vision Studio is a React-based application built with TypeScript and Vite. It features a chat interface powered by AI, properties panel, and preview panel for building and visualizing React components. The application uses Python FastAPI for the backend and integrates with Lovable AI Gateway for chat functionality.

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite 5
- **UI Framework**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Backend**: Python FastAPI
- **State Management**: TanStack React Query
- **Routing**: React Router v6
- **AI Integration**: Vercel AI SDK, Lovable AI Gateway
- **Forms**: React Hook Form with Zod validation

## Setup Commands

### Quick Start (Both Servers)

```bash
# macOS/Linux - starts both frontend and backend
./start-dev.sh

# Windows - starts both frontend and backend
start-dev.bat
```

The startup scripts will:

- Create Python virtual environment if needed
- Install all dependencies
- Create `.env` file from template
- Start both servers (backend on 54321, frontend on 8080)

### Frontend Only

```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Backend Only (Python FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (macOS/Linux)
source venv/bin/activate

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add LOVABLE_API_KEY
# LOVABLE_API_KEY=your_key_here

# Start FastAPI server (runs on port 54321)
python main.py

# Or with auto-reload
uvicorn main:app --host 0.0.0.0 --port 54321 --reload
```

## Development Servers

- Frontend dev server runs on `http://[::]:8080`
- Backend API server runs on `http://127.0.0.1:54321`
- API proxy is configured: `/api/*` → `http://127.0.0.1:54321`
- FastAPI automatic docs at `http://localhost:54321/docs`
- You need to run BOTH servers for full functionality

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatPanel.tsx   # AI chat interface
│   ├── PreviewPanel.tsx # Component preview
│   ├── PropertiesPanel.tsx # Component properties editor
│   └── ui/             # shadcn/ui components
├── pages/              # Route pages
│   ├── Index.tsx       # Home page
│   ├── DemoApp.tsx     # Main demo application
│   └── NotFound.tsx    # 404 page
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── integrations/       # Third-party integrations
    └── supabase/       # Supabase client and types

backend/                # Python FastAPI backend
├── main.py            # FastAPI application
├── requirements.txt   # Python dependencies
├── .env              # Environment variables (create this)
└── README.md         # Backend documentation
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new files
- Compiler options: `noImplicitAny: false`, `strictNullChecks: false`
- Path alias `@/*` maps to `./src/*`
- Import components using the `@/` alias

### React

- Functional components with React 18 features
- Use hooks for state management
- Component files use PascalCase (e.g., `ChatPanel.tsx`)
- Use the SWC plugin for fast refresh

### Python (Backend)

- Use async/await for asynchronous operations
- Follow PEP 8 style guidelines
- Use Pydantic models for request/response validation
- Type hints for all function parameters and returns
- FastAPI automatic validation and documentation

### Styling

- Tailwind CSS for all styling
- Use `cn()` utility from `@/lib/utils` for conditional classes
- shadcn/ui components are in `src/components/ui/`
- Follow shadcn/ui conventions for component styling

### Naming Conventions

- Components: PascalCase (e.g., `ChatPanel`)
- Files: PascalCase for components, kebab-case for utilities
- Hooks: camelCase with `use` prefix (e.g., `useMobile`)
- Constants: UPPER_SNAKE_CASE
- Python functions: snake_case
- Python classes: PascalCase

## Adding shadcn/ui Components

```bash
# Use the shadcn CLI to add components
npx shadcn@latest add <component-name>
```

Components are configured in `components.json` and will be added to `src/components/ui/`.

## Backend API

### Local Development

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py
```

### Environment Variables

Create a `backend/.env` file with:

- `LOVABLE_API_KEY`: Required for AI chat functionality

### API Endpoints

#### Chat Endpoint

- **POST** `/api/chat`
- Uses Lovable AI Gateway with `google/gemini-2.5-flash` model
- Supports streaming responses
- Accepts context (route, viewport, selected element)
- Request body:

  ```json
  {
    "messages": [{"role": "user", "content": "..."}],
    "context": {
      "route": "/",
      "viewport": {"width": 1920, "height": 1080}
    }
  }
  ```

#### Properties Endpoint

- **POST** `/api/properties`
- Updates component properties
- Request body:

  ```json
  {
    "elementId": "element-123",
    "properties": {"color": "blue", "size": "large"}
  }
  ```

### Backend Tech Stack

- **Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **HTTP Client**: httpx (for async requests)
- **Validation**: Pydantic
- **CORS**: Enabled for all origins in development

## Routing

- React Router v6 is configured in `src/App.tsx`
- Add new routes in the `Routes` component
- Always add custom routes ABOVE the catch-all `"*"` route
- 404 page handled by `NotFound` component

## State Management

- Use TanStack React Query for server state
- `QueryClient` is configured in `src/App.tsx`
- For local state, use React hooks (`useState`, `useReducer`)

## Building and Deployment

### Production Build

```bash
npm run build
```

Output is in the `dist/` directory.

### Development Build

```bash
npm run build:dev
```

Builds with development mode for debugging.

### Preview

```bash
npm run preview
```

Preview the production build locally.

## Common Tasks

### Adding a New Page

1. Create a new component in `src/pages/`
2. Add a route in `src/App.tsx` (above the `*` catch-all route)
3. Update navigation components as needed

### Adding a New UI Component

1. Use `npx shadcn@latest add <component>` for shadcn components
2. For custom components, create in `src/components/`
3. Import using `@/components/<name>`

### Modifying Backend API

1. Edit `backend/main.py`
2. Backend uses Python FastAPI with async/await
3. Test locally: `cd backend && python main.py`
4. CORS is configured via FastAPI middleware
5. Use Pydantic models for request/response validation
6. View API docs at `http://localhost:54321/docs`

### Adding a New API Endpoint

1. Open `backend/main.py`
2. Create Pydantic models for request/response if needed
3. Add a new route function decorated with `@app.post()` or `@app.get()`
4. Implement the endpoint logic with async/await
5. Test using the FastAPI docs UI or curl

### Styling a Component

1. Use Tailwind utility classes
2. Import `cn` from `@/lib/utils` for conditional classes
3. Follow existing component patterns in `src/components/ui/`
4. Use CSS variables defined in `src/index.css` for theme colors

## Environment Setup

### Required

- Node.js (recommended: use nvm)
- npm or equivalent package manager
- Python 3.8+ (for backend)
- pip (Python package manager)

### Optional

- Git (for version control)
- Python virtual environment tools (venv, virtualenv)

## Important Notes

- This project was scaffolded by Lovable.dev
- Component tagger is enabled in development mode
- The project uses ESM (ES Modules) - `"type": "module"` in package.json
- Vite proxy rewrites `/api/*` to FastAPI backend
- All shadcn/ui components use Radix UI primitives underneath
- Backend runs separately from frontend - start both servers for development
- Use the startup scripts (`start-dev.sh` or `start-dev.bat`) for easy setup

## Linting

```bash
npm run lint
```

ESLint is configured with:

- React Hooks plugin
- React Refresh plugin
- TypeScript ESLint

Fix linting issues before committing changes.

## Git Workflow

- Commit staged changes only after testing locally
- Run `npm run lint` before committing
- Test the dev server works: `npm run dev`
- Test the backend works: `cd backend && python main.py`
- Ensure no TypeScript errors: `npx tsc --noEmit`

## Debugging

### Frontend

- React DevTools for component inspection
- Vite provides detailed error messages in the browser
- Check browser console for runtime errors
- Network tab for API request inspection

### Backend

- FastAPI provides detailed error traces
- Check terminal output where `python main.py` is running
- Use `print()` statements or Python debugger (`pdb`)
- FastAPI automatic docs at `http://localhost:54321/docs`
- Interactive API testing via docs UI

## Performance Considerations

- Vite uses SWC for fast builds and HMR
- React 18 concurrent features are available
- Use React Query for efficient data fetching and caching
- Lazy load routes with `React.lazy()` if needed for code splitting
- Images should be optimized before adding to `public/`
- FastAPI uses async/await for non-blocking I/O

## Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Backend accesses env vars via `os.getenv()`
- CORS headers are configured in FastAPI middleware
- Validate all user inputs with Zod schemas (frontend) and Pydantic (backend)
- Keep dependencies up to date

## Testing

Currently, no test framework is configured. To add testing:

### Frontend Testing

1. Install Vitest: `npm install -D vitest @vitest/ui`
2. Add test script to package.json
3. Create test files with `.test.tsx` or `.test.ts` extension
4. Follow React Testing Library patterns

### Backend Testing

1. Install pytest: `pip install pytest pytest-asyncio httpx`
2. Create `backend/tests/` directory
3. Write tests using pytest and FastAPI's TestClient
4. Run tests with `pytest`
