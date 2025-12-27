# Welcome to your Lovable project

## Project info

React Vision Studio is a visual editor for React applications. It allows you to edit React projects in real-time with AI assistance.

**URL**: https://lovable.dev/projects/906de6ab-5b43-4c6b-a979-a29a237e06af

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/906de6ab-5b43-4c6b-a979-a29a237e06af) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

Requirements:
- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Python 3.8+ (for the FastAPI backend)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Quick start - run all 3 servers (demo, backend, editor)
# On macOS/Linux:
./start-dev.sh

# On Windows:
start-dev.bat

# This will start:
# - Demo Project on port 3000
# - Backend API on port 54321
# - Vision Studio Editor on port 8080

# Or manually:
# Terminal 1 - Demo Project
cd demo-project
npm install
npm run dev

# Terminal 2 - Backend API
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Create backend/.env and add OPENAI_API_KEY=your_key_here
python main.py

# Terminal 3 - Vision Studio Editor
npm install
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Architecture

This project consists of 3 separate services:

### 1. Vision Studio Editor (port 8080)
The main editor interface with:
- AI Chat Panel - Get AI assistance for building components
- Preview Panel - See your app in real-time
- Properties Panel - Edit component properties visually

**Technologies:**
- React 18, TypeScript
- Vite 5
- shadcn-ui, Tailwind CSS

### 2. Demo Project (port 3000)
A sample React application that can be edited with the studio. You can replace this with any React project.

**Technologies:**
- React 18, TypeScript
- Vite
- React Router

### 3. Backend API (port 54321)
Provides AI chat functionality powered by OpenAI.

**Technologies:**
- Python FastAPI
- OpenAI API (gpt-4o-mini)
- Uvicorn server

## How to Use with Your Own Project

1. Start your React project on any port (e.g., 3000, 5173, etc.)
2. Create a `.env` file in the Vision Studio root:
   ```
   VITE_TARGET_PROJECT_URL=http://localhost:YOUR_PORT
   ```
3. Run `./start-dev.sh` (or just start the editor: `npm run dev`)
4. The editor will load your project in the preview panel
5. Use AI chat to modify your app, and see changes in real-time!

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/906de6ab-5b43-4c6b-a979-a29a237e06af) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
