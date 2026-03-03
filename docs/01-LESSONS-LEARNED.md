# MinitoolboxMCP — Lessons Learned & Handoff

> **Date:** March 3, 2026  
> **Author:** Session work log  
> **Status:** Phase 1 complete, Phase 2 (MCP integration) in progress

---

## 1. What We Accomplished

### Electron + React Frontend (Complete)
- **Custom VS Code-style UI** — icon-only sidebar (48px), custom frameless title bar with window controls, VS Code status bar with accent notification bell
- **Granite/electric purple theme** via Tailwind CSS v4 custom tokens
- **Capture page** — dropdown source picker, refresh, live preview (500ms polling), auto-capture on selection, auto-save to `outputs/`
- **Gallery page** — thumbnail grid of saved screenshots, full-screen lightbox with backdrop blur, "Open External" button (opens in system photo viewer via `shell.openPath`)
- **Settings dialog** — acrylic sidebar, General tab with output folder picker (native OS dialog) and clear cache
- **Hidden capture worker** — invisible `BrowserWindow` loads `/#/capture` React route, uses `getUserMedia` with `chromeMediaSource: 'desktop'` for real GPU-rendered frame capture
- **System tray** — custom SVG icon, dynamic context menu listing all windows, double-click to restore, right-click for capture menu
- **30-second auto-polling** for window list refresh

### Backend Scaffold (Complete)
- **Fastify 5** API server on port 3100 with `@fastify/websocket`
- **MCP server** with 4 tools: `list_screenshots`, `get_output_dir`, `clear_screenshots`, `capture_screenshot`
- **Centralized logger** writing to both console (colored) and `logs/*.log` file
- **Proper project structure**: `types/`, `utils/`, `services/`, `controllers/`, `routes/`
- **WebSocket handler** with client tracking, broadcast utility, and message protocol

### Dev Experience
- `npm run dev` — concurrent Vite + backend + Electron with auto port cleanup (`kill-port 5173 3100`)
- `--kill-others` flag on `concurrently` ensures clean shutdown
- Electron `will-quit` handler kills Vite port in dev mode

---

## 2. What Work Remains

| Item | Priority | Difficulty |
|------|----------|------------|
| Wire `capture_screenshot` MCP tool end-to-end (MCP → REST → WS → Electron → save) | **Critical** | Medium |
| Frontend connects to backend WebSocket at `ws://localhost:3100/ws` | **High** | Low |
| Frontend Zustand store (consider adopting — see BgEditor pattern in KI) | **High** | Medium |
| Move capture IPC out of Electron direct handlers → route through backend | **Medium** | Medium |
| Electron IPC bridge for backend ↔ Electron capture relay | **Medium** | Medium |
| Production build pipeline (Vite build → Electron `extraResources`) | **Low** | Low |
| MCP client configuration / `.cursor` or `.gemini` config file | **Low** | Low |
| Add more MCP tools (resize, crop, list windows, compare screenshots) | **Low** | Low |

---

## 3. Optimizations — Top 4 Suspects

### 3.1 Gallery loads all PNGs as base64 into memory
The `list-outputs` handler reads every PNG file into a full base64 data URL. With 50+ large screenshots, this will be slow and memory-heavy.

**Fix:** Return only metadata (name, path, size, timestamp). Serve thumbnails lazily via a `/api/screenshots/:name/thumb` endpoint that generates 200px thumbnails on-the-fly or caches them.

### 3.2 `desktopCapturer.getSources()` with 200×200 thumbnails per refresh
Every 30 seconds, we're asking Chromium to render 200×200 thumbnails of every window. We don't even use the thumbnails in the dropdown — they're discarded.

**Fix:** Use `thumbnailSize: { width: 1, height: 1 }` for the dropdown listing. Only request full thumbnails when the gallery or a preview feature needs them. The earlier attempt at `0×0` broke enumeration, but `1×1` should work.

### 3.3 Capture worker creates/destroys a `getUserMedia` stream per capture
Each capture opens a new `getUserMedia` stream, waits 100ms for frame settling, draws to canvas, then tears down the stream. Under live preview (500ms interval), this is 2 stream lifecycle rounds per second.

**Fix:** Keep the stream alive for the selected source. Only tear it down when switching sources or stopping live preview. This dramatically reduces latency and avoids the Windows recording indicator flashing.

### 3.4 Two `"Capture worker ready"` messages on startup
The hidden BrowserWindow fires `workerReady()` twice (likely React StrictMode double-mount in dev). This means the `onCaptureRequest` listener is registered twice, which could cause duplicate capture responses.

**Fix:** Either disable StrictMode for the capture worker route, or add a guard in the `useEffect` to prevent double-registration (use a `ref` flag).

---

## 4. Step-by-Step: Get the App Fully Working

```bash
# 1. Prerequisites
node --version        # v22+
npm --version         # 10+

# 2. Install all workspaces
cd D:\Projects\MinitoolboxMCP
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
cd electron && npm install && cd ..

# 3. Start everything
npm run dev
# This runs:
#   kill-port 5173 3100
#   concurrently: vite (green) | backend (yellow) | electron (blue)

# 4. Verify
# - Vite:     http://localhost:5173  (React dev server)
# - Backend:  http://localhost:3100  (Fastify API)
# - Electron: Window should open with custom title bar

# 5. Test capture
# - Click ⟳ refresh in the Capture page toolbar
# - Select a window from the dropdown → should auto-capture + save
# - Check the outputs/ folder for saved PNGs

# 6. Test gallery
# - Click the Image icon in the sidebar
# - Thumbnails should appear → click for lightbox

# 7. Test settings
# - Click the gear icon at the bottom of the sidebar
# - Change output folder, clear cache

# 8. Test API
curl http://localhost:3100/api/health
curl http://localhost:3100/api/screenshots
```

---

## 5. How to Start/Test the API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status + uptime |
| `GET` | `/api/screenshots` | List all saved PNGs (name, path, size) |
| `GET` | `/api/screenshots/output-dir` | Current output directory |
| `POST` | `/api/screenshots/output-dir` | `{ "path": "C:\\..." }` — set output dir |
| `POST` | `/api/screenshots/clear` | Delete all PNGs, returns `{ deleted: N }` |

### WebSocket

Connect to `ws://localhost:3100/ws`. Messages are JSON:

```json
{ "type": "gallery:refresh", "payload": {}, "timestamp": 1709500000000 }
```

### MCP Server

The MCP server runs over stdio. To test with an MCP client:

```bash
cd backend && npm run mcp
```

Or configure in your client's MCP config:
```json
{
  "minitoolbox": {
    "command": "node",
    "args": ["D:/Projects/MinitoolboxMCP/backend/dist/mcp-server.js"]
  }
}
```

---

## 6. Known Issues & Strategies

### Issue 1: DXGI Frame Capture Failures
```
ERROR: Failed to capture 5 frames within 500 milliseconds
ERROR: DxgiDuplicatorController failed to capture desktop
```
This is a Chromium/DirectX limitation on some GPU configs. The `desktopCapturer` API uses DXGI duplication which can fail when:
- The GPU is under heavy load
- The target window uses exclusive fullscreen
- Multiple capture sessions compete

**Strategy:** Fall back gracefully — catch the error and retry with a 1-second delay. If 3 retries fail, fall back to `desktopCapturer.getSources()` with a large `thumbnailSize` (less reliable but doesn't need DXGI).

### Issue 2: Window Enumeration Inconsistency
`desktopCapturer.getSources({ types: ['window'] })` returns different counts on different runs. Some windows are missed, especially:
- UWP/Store apps
- Admin-elevated windows (when Electron isn't elevated)
- Windows that are minimized or offscreen

**Strategy:** Supplement with a Node native addon like `@aspect-build/windows` or shell out to PowerShell `Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }` for a complete process list. Cross-reference with `desktopCapturer` results and merge.

### Issue 3: Yellow Recording Border (Windows 11)
`getUserMedia` with `chromeMediaSource: 'desktop'` triggers the Windows 11 screen recording privacy indicator (yellow border on all windows). This persists for ~2 seconds after stream teardown.

**Strategy:** Minimize stream lifetime — open, capture one frame, close immediately (reduce the 100ms settle delay). Consider using `desktopCapturer.getSources()` with large `thumbnailSize` for the tray quick-capture path (no `getUserMedia` needed), and reserve the worker only for high-quality live preview.

### Issue 4: Backend ↔ Electron Capture Relay Not Wired
The MCP `capture_screenshot` tool POSTs to `/api/screenshots/capture`, but that endpoint doesn't exist yet. The backend needs to relay the request to Electron via WebSocket, and Electron needs to listen for it.

**Strategy:** 
1. Add a `/api/screenshots/capture` route that sends a WS message to all clients with `type: 'capture:request'`
2. Electron's main process connects to the backend WS as a client
3. On receiving `capture:request`, Electron triggers the hidden capture worker
4. Electron sends the result back via WS `capture:result`
5. The REST handler awaits the WS response (with timeout) and returns it

---

## 7. Architecture Insights & Quick Wins

### From BgEditor KI (Proven Pattern)
Our architecture mirrors the BgEditor project's established MCP pipeline:
```
MCP Tool → POST /api/xxx → broadcast(WS) → Frontend handler → Store action → UI
```
**Insight:** BgEditor uses a centralized Zustand store with a `useBackendEvents` hook that dispatches WS messages to store actions. We should adopt this pattern for the frontend.

### Quick Win 1: Zustand Store
Replace the scattered `useState` calls in `IndexPage` with a single `useCaptureStore`:
```
{ sources, selectedId, capture, isLive, status } + actions
```
This makes state accessible from any component and enables the WS → store dispatch pattern.

### Quick Win 2: `useBackendEvents` Hook
A single hook that connects to `ws://localhost:3100/ws` and dispatches messages:
```
case 'capture:result': → store.setCapture(payload)
case 'gallery:result': → store.setGalleryFiles(payload)
case 'status:update':  → store.setStatus(payload)
```

### Quick Win 3: Health Check in Status Bar
The VS Code status bar currently shows static info. Wire it to the backend health check — show a green dot when the backend is reachable, red when it's down. Poll `/api/health` every 10 seconds.

### Quick Win 4: Toast Notifications
The bell icon in the status bar is currently non-functional. Use it to show a notification count, and display toast messages when:
- A screenshot is auto-saved
- The gallery has new items
- An MCP tool is invoked (shows the tool name + params)

---

## 8. File Structure Reference

```
MinitoolboxMCP/
├── frontend/src/
│   ├── types/electron.ts
│   ├── components/ (TitleBar, Preview, VscodeStatusBar, SettingsDialog)
│   ├── layouts/AppLayout.tsx
│   ├── pages/ (index, gallery, capture-worker)
│   ├── main.tsx (HashRouter)
│   └── index.css (Tailwind v4)
├── backend/src/
│   ├── types/index.ts
│   ├── utils/logger.ts
│   ├── services/screenshot.service.ts
│   ├── controllers/screenshot.controller.ts
│   ├── routes/screenshot.routes.ts
│   ├── websocket.ts
│   ├── server.ts (Fastify :3100)
│   └── mcp-server.ts (stdio)
├── electron/src/
│   ├── main.ts (BrowserWindow, tray, IPC, capture worker)
│   └── preload.ts (contextBridge)
├── docs/
│   ├── 00-REQUIREMENTS.md
│   └── 01-LESSONS-LEARNED.md (this file)
└── package.json (root orchestrator)
```
