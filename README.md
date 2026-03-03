# MinitoolboxMCP

A developer utility toolkit exposed via MCP (Model Context Protocol). The first tool is a **Screenshot Capture Tool** that uses Electron to capture GPU-accelerated windows — giving AI agents visual context of running applications like Unity, Blender, or any desktop app.

Built with **Electron** (capture engine) + **React** (Vite frontend) + **Fastify** (API server + WebSocket) + **MCP** (stdio server).

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Shell (capture worker, tray, IPC)      │
│  └─ electron/                                    │
├─────────────────────────────────────────────────┤
│  Frontend (React + Vite)           :5173         │
│  └─ VS Code-style UI, gallery, settings          │
├──────────── WebSocket + REST ───────────────────┤
│  Backend Server (Fastify + WS)     :3100         │
│  └─ Screenshot service, navigation, commands     │
├─────────────────────────────────────────────────┤
│  MCP Server (Node.js stdio)                      │
│  └─ backend/src/mcp-server.ts → proxies to :3100 │
└─────────────────────────────────────────────────┘
```

## Features

**Capture** — Select any window from a dropdown, live preview at 500ms (auto-stops after 5s), auto-save screenshots to disk. Uses Electron's `desktopCapturer` + `getUserMedia` for GPU-rendered frame capture. Stream cleanup in `finally` block prevents lingering OS sharing indicators.

**Gallery** — Browse saved screenshots in a thumbnail grid. Click for full-screen lightbox with "Open External" button to launch in system photo viewer.

**Settings** — Acrylic sidebar dialog with output folder picker (native OS dialog) and clear cache.

**UI** — VS Code-style icon sidebar + menu bar (File, Capture, Gallery, Tools), custom frameless title bar, status bar with WebSocket indicator + API health check dot, granite + electric purple theme.

**MCP Integration** — 5 tools exposing all functionality to AI agents. Every tool except `list_sources` and `capture_screenshot` auto-appends a screenshot of the app's own UI via `capturePage()` (`withScreenshot` wrapper).

**Dual Screenshot Paths** — `capture_screenshot` uses `desktopCapturer` to capture any target window. All other tools use `webContents.capturePage()` to screenshot the Minitoolbox app itself, giving the AI visual feedback after every action.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite 7, Tailwind CSS 4, Lucide Icons |
| Backend | Node.js, TypeScript, Fastify 5, @fastify/websocket |
| Desktop | Electron (latest stable) |
| AI Integration | Model Context Protocol (MCP) via Node.js stdio server |

## Getting Started

### Prerequisites

- **[Node.js](https://nodejs.org/)** v22+ — check with `node --version`

### First-Time Setup

```bash
npm install                            # Root (concurrently, wait-on)
cd frontend && npm install && cd ..    # Frontend
cd backend  && npm install && cd ..    # Backend + MCP
cd electron && npm install && cd ..    # Electron
```

### Starting the App

From the **project root**:

```bash
npm run dev
```

**One command.** It does everything:

1. Kills stale processes on ports 5173 and 3100
2. Starts the Vite frontend on `http://localhost:5173`
3. Starts the Fastify backend on `http://localhost:3100`
4. Waits for the frontend, then launches the Electron window

You'll see three color-coded log streams:

- **[vite]** (green) — Vite dev server
- **[backend]** (yellow) — Fastify API + WebSocket
- **[electron]** (blue) — Electron window

> **Important:** Always run `npm run dev` from the project root. The root script handles port cleanup and service coordination.

### Stopping the App

Press `Ctrl+C`. The `--kill-others` flag shuts down all services together. Electron also kills port 5173 on quit.

### Troubleshooting

**"Port already in use"** — Run `npx kill-port 5173 3100` then try again.

**Electron doesn't open** — Frontend must be ready first. Check the `[vite]` log.

**Backend WS disconnected** — Check `[backend]` log for errors. The frontend auto-reconnects every 3 seconds.

## MCP Tools

The MCP server is named `minitoolbox`. Configure in your client:

```json
{
  "minitoolbox": {
    "command": "node",
    "args": ["D:/Projects/MinitoolboxMCP/backend/dist/mcp-server.js"]
  }
}
```

| Tool | Description | Parameters | Auto Screenshot |
|------|-------------|------------|----------------|
| `list_sources` | List all available windows | — | No |
| `capture_screenshot` | Capture a target window | `source_index` — index from `list_sources` | No (returns target) |
| `select_source` | Select window in dropdown | `window_name` — fuzzy match | ✅ App UI |
| `navigate_page` | Switch UI page | `page` — capture, gallery | ✅ App UI |
| `execute_command` | Run keyboard shortcut by ID | `command` — e.g. `capture.refresh` | ✅ App UI |

## REST API

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/health` | — | Server status + uptime |
| `POST` | `/api/sources/list` | — | List windows via WS relay |
| `POST` | `/api/sources/select` | `{ "windowName": "Unity" }` | Select source window |
| `POST` | `/api/screenshots/capture` | `{ "sourceIndex": 0 }` | Capture target window by index |
| `POST` | `/api/app-screenshot` | — | Capture app's own UI via `capturePage()` |
| `POST` | `/api/screenshots/list` | — | List all saved PNGs |
| `POST` | `/api/screenshots/get-output-dir` | — | Current output directory |
| `POST` | `/api/screenshots/set-output-dir` | `{ "path": "C:\\..." }` | Set output directory |
| `POST` | `/api/screenshots/clear` | — | Delete all PNGs |
| `POST` | `/api/navigate` | `{ "page": "gallery" }` | Navigate frontend page |
| `POST` | `/api/execute-command` | `{ "command": "app.toggle-devtools" }` | Execute keyboard command |

WebSocket: `ws://localhost:3100/ws`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F12` | Toggle Developer Tools |
| `Ctrl+,` | Toggle Settings Dialog |
| `Ctrl+R` | Reload Window |
| `Ctrl+1` | Go to Capture page |
| `Ctrl+2` | Go to Gallery page |
| `F5` | Refresh window sources |

Press `?` for shortcut overlay (planned).

## Project Structure

```
MinitoolboxMCP/
├── frontend/                    # React + Vite app
│   └── src/
│       ├── components/          # TitleBar, MenuBar, Preview, StatusBar, Settings
│       ├── layouts/             # AppLayout (sidebar + menu bar + status bar)
│       ├── pages/               # Capture, Gallery, CaptureWorker
│       ├── hooks/               # useWebSocket (WS message dispatch)
│       ├── store/               # Zustand store (sources, capture, live)
│       ├── lib/keyboard/        # KeyboardRegistry, commands
│       └── types/               # ElectronAPI interfaces
├── backend/                     # Fastify + MCP server
│   └── src/
│       ├── types/               # Shared types (WsMessage, OutputFile)
│       ├── utils/               # Centralized logger (file + console)
│       ├── services/            # ScreenshotService
│       ├── controllers/         # Fastify request handlers
│       ├── routes/              # screenshot, navigation, command, source routes
│       ├── websocket.ts         # WS client tracking, pending requests, broadcast
│       ├── server.ts            # Fastify entrypoint (:3100)
│       └── mcp-server.ts        # 5 MCP tools + withScreenshot wrapper (stdio)
├── electron/                    # Electron desktop shell
│   └── src/
│       ├── main.ts              # BrowserWindow, tray, IPC, capture worker
│       └── preload.ts           # Context bridge (captureSource, capturePage)
├── docs/                        # Architecture docs + session handoffs
│   ├── 00-REQUIREMENTS.md
│   ├── 01-LESSONS-LEARNED.md
│   └── 02-LESSONS-LEARNED.md
├── outputs/                     # Auto-saved screenshots
└── package.json                 # Root dev script (concurrently)
```
