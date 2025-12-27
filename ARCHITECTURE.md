# React Vision Studio - Architecture

## Overview

React Vision Studio is a visual editor for React applications that separates the editor from the project being edited.

## Three-Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  React Vision Studio Editor                  │
│                     (localhost:8080)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Chat Panel  │  │   Preview   │  │ Properties Panel    │ │
│  │ (AI Help)   │  │   (iframe)  │  │ (Edit Properties)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ loads via iframe
                              ▼
                ┌──────────────────────────┐
                │  Your React Project      │
                │  (localhost:3000)        │
                │  - Can be any React app  │
                │  - Runs independently    │
                └──────────────────────────┘
                              │
                              │ sends messages for AI chat
                              ▼
                ┌──────────────────────────┐
                │  Backend API             │
                │  (localhost:54321)       │
                │  - FastAPI               │
                │  - OpenAI Integration    │
                └──────────────────────────┘
```

## How It Works

1. **Vision Studio Editor** - The main interface
   - Loads your React app in an iframe
   - Provides AI chat for assistance
   - Allows visual editing of components
   - Communicates with the target app via postMessage

2. **Target Project** (demo-project or your own)
   - Runs independently on its own port
   - Can be any React application
   - Receives commands from the editor
   - Sends context updates back

3. **Backend API**
   - Provides AI chat functionality
   - Streams responses from OpenAI
   - No state management - stateless API

## Communication Flow

```
User Types in Chat
       ↓
Editor sends to Backend API
       ↓
Backend calls OpenAI API
       ↓
Streams response back to Editor
       ↓
Editor displays AI response
       ↓
User can apply changes to Target Project
```

## Configuration

### Editor Configuration (.env in root)
```bash
VITE_TARGET_PROJECT_URL=http://localhost:3000
```

### Backend Configuration (backend/.env)
```bash
OPENAI_API_KEY=sk-...
```

## Starting Development

### All Services at Once
```bash
./start-dev.sh
```

### Individual Services
```bash
# Terminal 1 - Your React Project
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

To edit your own React project:

1. Ensure your project runs on a specific port
2. Configure `VITE_TARGET_PROJECT_URL` to point to that port
3. Start Vision Studio Editor
4. The editor will load your project

## Benefits of This Architecture

- **Separation of Concerns**: Editor and target project are independent
- **Flexibility**: Work with any React project
- **Scalability**: Each service can be scaled independently
- **Development**: Easy to work on one service without affecting others
- **Deployment**: Can deploy services separately

## Future Enhancements

- File system access to actually edit code files
- Multiple project support
- Component library browser
- Real-time collaboration
- Cloud deployment options

