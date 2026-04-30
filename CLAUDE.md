# Algo Sentido Tools - Claude Code Project Context

## What is this project?
AS Tools (Algo Sentido Tools) is a full-stack web app with multiple internal tools:
1. **Transcribe** — Extracts video transcriptions from YouTube, Instagram Reels, TikTok, and Facebook
2. **Convert** — Converts documents (PDF, DOCX, PPTX, XLSX, EPUB) to Markdown / HTML / structured PDF (MarkItDown + pymupdf4llm)
3. **Secretos** — Encrypted secret sharing (AES-256-GCM): any logged-in user creates a secret, gets a one-time link; only the owner can decrypt. 30-day auto-expiry.

Auth: email+password (bcrypt+JWT) plus magic link login by email (Resend, 15min single-use). First registered user becomes `owner`.

**Acceso temporal por usuario** (para clientes): el owner asigna `access_expires_at` desde el panel admin (tab Usuarios). El `authMiddleware` valida la expiración contra DB en cada request (owner exento). Login y magic link rechazan usuarios expirados con mensaje claro. NULL = sin límite (uso interno). Endpoint: `PATCH /api/admin/users/:id/access`.

**Panel admin con tabs** (`/admin`): organizado en Resumen / Usuarios / Transcripciones / Conversiones / Secretos. El tab activo se persiste en `localStorage` (clave `admin_active_tab`).

Part of the Algo Sentido internal toolset. Designed to scale with more tools over time.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js, ESM modules)
- **Database**: SQLite3 (file-based, `data/as-transcribe.db`)
- **AI/LLM**: Anthropic Claude API + OpenAI API (fallback via `LLM_PROVIDER` env)
- **Transcription**: OpenAI `gpt-4o-mini-transcribe`
- **Document conversion**: Microsoft MarkItDown (Python CLI via child_process)
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
│   ├── convertDocument.js       # Document-to-Markdown conversion (MarkItDown)
│   ├── secrets.js               # Secretos: create/list/reveal/delete handlers
│   ├── auth.js                  # JWT + bcrypt + magic link helpers
│   ├── services/
│   │   ├── llmService.js        # LLM provider router (Anthropic/OpenAI)
│   │   ├── anthropicService.js  # Claude API integration
│   │   ├── openaiService.js     # OpenAI chat integration
│   │   ├── cryptoService.js     # AES-256-GCM encrypt/decrypt for Secretos
│   │   ├── emailService.js      # Resend wrapper for magic link emails
│   │   ├── logService.js        # API logging
│   │   └── transcriptionService.js
│   ├── controllers/             # Script, client, document, log controllers
│   ├── routes/                  # Express routes (clients, scripts, logs)
│   ├── database/
│   │   └── schema.js            # SQLite schema (users, transcriptions, conversions, usage_stats, settings, secrets, magic_link_tokens)
│   ├── rag/                     # RAG document processor (TF-IDF with natural)
│   └── utils/                   # Platform detector, usage tracker
├── src/
│   ├── App.jsx                  # React Router (/, /transcribir, /convertir, /secretos, /secreto/:token, /magic/:token, /mis-resultados, /admin)
│   ├── pages/                   # ToolHub, Home, ConvertPage, SecretsPage, ViewSecretPage, MagicLinkPage, MyResults, AdminPanel, LoginPage, NotFound
│   ├── components/              # TranscriptionForm, ConvertForm, Header, Footer, etc.
│   ├── context/                 # AuthContext, TranscriptionContext, ConversionContext
│   ├── services/                # API client, usageStats service
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
- `JWT_SECRET` — Secret for JWT token signing
- `SECRETS_ENCRYPTION_KEY` — 64-char hex (32 bytes) for AES-256-GCM. `start.sh` autogenerates if missing.
- `RESEND_API_KEY` — Resend key for magic link emails. Without it, links go to server console (dev fallback).
- `MAGIC_LINK_FROM_EMAIL` — Sender address (must be on a verified domain in Resend; `onboarding@resend.dev` for dev).
- `APP_BASE_URL` — Public URL where the app lives. Used to build magic link URLs. In dev set to `http://localhost:5173`.
- `LLM_PROVIDER` — Force `anthropic` or `openai` (auto-detects by default)
- `PORT` — Server port (default 3000)
- `FFMPEG_PATH` — Custom ffmpeg path (optional)
- `MARKITDOWN_PATH` — Custom markitdown path (optional)

## External Dependencies
- `yt-dlp` — Video download (called via child_process)
- `ffmpeg` — Audio extraction (called via child_process)
- `markitdown` — Document conversion (Python CLI, installed via `pipx install 'markitdown[all]'`)

## Conventions
- Language: Spanish for UI text and comments, English for code identifiers
- ESM modules throughout (`"type": "module"` in package.json)
- API routes prefixed with `/api/`
- Frontend uses React functional components + hooks
- TailwindCSS for styling with dark mode support
- SQLite for all persistence (no external DB needed)
- Each tool has its own Context, Form, Results, and Saved components
- ToolHub (`/`) serves as the home dashboard; each tool gets its own route

## Architecture Pattern for Adding New Tools
1. Backend: new handler in `api/`, new functions in `usageTrackerSQLite.js`, new routes in `server.js`
2. DB: new table in `schema.js`
3. Frontend: new Context, Form, Results, SavedX components
4. New page in `src/pages/`, new route in `App.jsx`
5. Add card to `ToolHub.jsx`, link in `Header.jsx` and `Footer.jsx`
6. Add tab in `MyResults.jsx`, section in `AdminPanel.jsx`

## Portable Claude Setup
This project keeps all Claude Code config in git for portability across machines:
- `CLAUDE.md` — Project context (this file)
- `.claude/settings.json` — Permissions and hooks (the PostToolUse hook is portable: derives the local Claude memory path from `git rev-parse --show-toplevel`, no hardcoded user dir)
- `.claude/memory/` — Claude memories (synced via hook on every Write/Edit)
- `.claude/sync-memories.sh` — Manual sync script (`pull` from repo to local, `push` from local to repo)

**On a new machine after cloning:**
```bash
.claude/sync-memories.sh pull
pipx install 'markitdown[all]'  # Requires Python 3.10+
```
This copies memories from the repo to your local Claude config.

**The PostToolUse hook** in `.claude/settings.json` automatically syncs memories from local Claude to the repo on every file write/edit, so they stay updated for the next commit.
