# ViralAI - Claude Code Project Context

## What is this project?
ViralAI is a full-stack web app that extracts video transcriptions and generates viral social media scripts using AI. It supports YouTube, Instagram Reels, TikTok, and Facebook.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js, ESM modules)
- **Database**: SQLite3 (file-based, `data/viraler.db`)
- **AI/LLM**: Anthropic Claude API + OpenAI API (fallback via `LLM_PROVIDER` env)
- **Transcription**: OpenAI `gpt-4o-mini-transcribe`
- **Audio extraction**: yt-dlp + FFmpeg
- **Deployment**: Render (with Docker support)

## Project Structure
```
├── server.js                    # Express entry point
├── api/
│   ├── transcribeVideo.js       # URL-based transcription endpoint
│   ├── transcribeUpload.js      # File upload transcription endpoint
│   ├── transcribeAudio.js       # Whisper/gpt-4o-mini-transcribe API call
│   ├── extractAudio.js          # yt-dlp audio extraction
│   ├── services/
│   │   ├── llmService.js        # LLM provider router (Anthropic/OpenAI)
│   │   ├── anthropicService.js  # Claude API integration
│   │   ├── openaiService.js     # OpenAI chat integration
│   │   ├── logService.js        # API logging
│   │   └── transcriptionService.js
│   ├── controllers/             # Script, client, document, log controllers
│   ├── routes/                  # Express routes (clients, scripts, logs)
│   ├── database/
│   │   └── schema.js            # SQLite schema (9 tables)
│   ├── rag/                     # RAG document processor (TF-IDF with natural)
│   └── utils/                   # Platform detector, usage tracker
├── src/
│   ├── App.jsx                  # React Router (8 routes)
│   ├── pages/                   # Home, MyResults, Admin, Clients, Scripts, Logs, NotFound
│   ├── components/              # TranscriptionForm, Header, Footer, etc.
│   ├── context/                 # TranscriptionContext (URL + file upload)
│   ├── services/                # API client, script/client/log services
│   └── hooks/                   # useLocalStorage, useTranscription
└── data/                        # SQLite database (gitignored)
```

## Key Commands
```bash
npm run dev            # Start frontend + backend concurrently
npm run dev:frontend   # Vite dev server only
npm run dev:backend    # Express with nodemon only
npm run build          # Production build (Vite)
npm start              # Production server
npm run migrate        # Migrate JSON data to SQLite
```

## Environment Variables
Required in `.env`:
- `OPENAI_API_KEY` — For transcription (gpt-4o-mini-transcribe) and script generation fallback
- `ANTHROPIC_API_KEY` — For script generation (primary)
- `LLM_PROVIDER` — Force `anthropic` or `openai` (auto-detects by default)
- `PORT` — Server port (default 3000)
- `FFMPEG_PATH` — Custom ffmpeg path (optional)

## Conventions
- Language: Spanish for UI text and comments, English for code identifiers
- ESM modules throughout (`"type": "module"` in package.json)
- API routes prefixed with `/api/`
- Frontend uses React functional components + hooks
- TailwindCSS for styling with dark mode support
- SQLite for all persistence (no external DB needed)

## Portable Claude Setup
This project keeps all Claude Code config in git for portability across machines:
- `CLAUDE.md` — Project context (this file)
- `.claude/settings.json` — Permissions and hooks
- `.claude/memory/` — Claude memories (synced via hook)
- `.claude/sync-memories.sh` — Manual sync script

**On a new machine after cloning:**
```bash
.claude/sync-memories.sh pull
```
This copies memories from the repo to your local Claude config.

**The PostToolUse hook** in `.claude/settings.json` automatically syncs memories from local Claude to the repo on every file write/edit, so they stay updated for the next commit.
