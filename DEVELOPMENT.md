# Open V0 - Architecture

## Overview

Open V0 is a visual editor for frontend applications that separates the editor from the project being edited.

## Three-Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Open V0 Editor                          │
│                     (localhost:8080)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat Panel  │  │   Preview   │  │ Properties Panel    │  │
│  │ (AI Help)   │  │   (iframe)  │  │ (Edit Properties)   │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘  │
└─────────┼───────────────┼───────────────────────────────────┘
          │               │
          │               │ loads via iframe
          │               ▼
          │       ┌──────────────────────────┐
          │       │  Your Frontend Project   │
          │       │  (localhost:3000)        │
          │       │  - Any frontend app      │
          │       │  - Runs independently    │
          │       └──────────────────────────┘
          │                       ▲
          │ sends messages        │ AI updates frontend code
          │ for AI chat           │
          ▼                       │
┌──────────────────────────────────┘
│  Backend API
│  (localhost:54321)
│  - FastAPI
│  - Claude via Agentlys
└──────────────────────────┘
```

## How It Works

1. **Vision Studio Editor** - The main interface

   - Loads your frontend app in an iframe
   - Provides AI chat for assistance
   - Allows visual editing of components
   - Communicates with the target app via postMessage

2. **Target Project** (demo-project or your own)

   - Runs independently on its own port
   - Can be any frontend application (React, Vue, Svelte, etc.)
   - Receives commands from the editor
   - Sends context updates back

3. **Backend API**
   - Provides AI chat functionality
   - Streams responses from Claude
   - No state management - stateless API

## Communication Flow

```
User Types in Chat
       ↓
Editor sends to Backend API
       ↓
Backend calls Claude API (via Agentlys)
       ↓
Streams response back to Editor
       ↓
Editor displays AI response
       ↓
User can apply changes to Target Project
```

## Configuration

### Backend Configuration (backend/.env)

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

## Starting Development

### All Services at Once

```bash
./start-dev.sh
```

### Individual Services

```bash
# Terminal 1 - Your Frontend Project
cd demo-project  # or your own project
npm run dev

# Terminal 2 - Backend API
cd backend
source venv/bin/activate
python main.py

# Terminal 3 - Editor
npm run dev
```

## Editing External Projects

To edit your own frontend project:

1. Run `./start-dev.sh` to start the Editor and Backend
2. Open http://localhost:8080
3. Click "Select Directory" and enter your project path
4. Click "Start" to run your project's dev server
5. The editor will load your project and you can start editing with AI

## Benefits of This Architecture

- **Separation of Concerns**: Editor and target project are independent
- **Flexibility**: Work with any frontend project
- **Scalability**: Each service can be scaled independently
- **Development**: Easy to work on one service without affecting others
- **Deployment**: Can deploy services separately

## Future Enhancements

- File system access to actually edit code files
- Multiple project support
- Component library browser
- Real-time collaboration
- Cloud deployment options
