# MinitoolboxMCP — Session 2 Handoff

> **Date:** March 3, 2026  
> **Status:** 4 of 5 MCP tools working. Capture pipeline broken by incomplete refactor.

---

## 1. What We Accomplished

### New Infrastructure
- **Zustand store** (`frontend/src/store/useAppStore.ts`) — centralized state for sources, selection, capture, live preview
- **WebSocket relay** (`frontend/src/hooks/useWebSocket.ts`) — handles `capture:request`, `sources:list`, `sources:select`, `app:capture`, navigation, and command execution
- **MCP server** (`backend/src/mcp-server.ts`) — 5 tools over stdio with stdout redirect to protect JSON-RPC
- **`withScreenshot` wrapper** — auto-appends an Electron app screenshot after every in-app MCP action
- **`capturePage()` IPC** (`electron/src/main.ts`) — uses `mainWindow.webContents.capturePage()` to screenshot the app's own UI (no desktopCapturer)
- **`/api/app-screenshot` route** — backend endpoint for app self-screenshot via WS relay
- **MCP config registered** in `~/.gemini/antigravity/mcp_config.json`

### UI Features
- **VS Code-style menu bar** (`frontend/src/components/MenuBar.tsx`) — File, Capture, Gallery, Tools menus with page-aware highlighting
- **Live preview auto-stop** — kills after 5 seconds to prevent runaway captures
- **Show/Hide/Quit commands** — IPC handlers + preload + keyboard commands
- **Vite error logger** — HMR/runtime/promise errors piped to terminal
- **Hot reload + polling** — 300ms poll for reliable Windows HMR

### MCP Tools Status

| Tool | Works? | Notes |
|------|--------|-------|
| `list_sources` | ✅ | Returns indexed window list |
| `select_source` | ✅ | Updates frontend dropdown + auto-captures |
| `navigate_page` | ✅ | Switches pages + returns app screenshot |
| `execute_command` | ✅ | Runs commands + returns app screenshot |
| `capture_screenshot` | ❌ | Broken — signature mismatch (see §2) |

---

## 2. What's Broken & How to Fix It

There is **one root cause** — `screenshot.routes.ts` was half-refactored from `windowName` to `sourceIndex`.

### The Bug

```
screenshot.routes.ts line 32:  requestCapture(sourceIndex ?? -1, windowName)  ← passes 2 args
websocket.ts line 40:          requestCapture(sourceIndex: number)            ← accepts 1 arg
```

TypeScript compilation passes because `requestCapture` returns `Promise<any>`, but at runtime the extra arg is silently ignored and `sourceIndex: -1` always fails.

### The Fix (3 files, ~10 lines)

**`screenshot.routes.ts`** — Remove `windowName`, pass only `sourceIndex`:
```diff
- const { sourceIndex, windowName } = req.body as { sourceIndex?: number; windowName?: string };
- if (sourceIndex === undefined && !windowName) {
+ const { sourceIndex } = req.body as { sourceIndex: number };
+ if (sourceIndex === undefined) {
-     return reply.status(400).send({ error: 'Missing "sourceIndex" or "windowName"' });
+     return reply.status(400).send({ error: 'Missing "sourceIndex"' });
  }
- const result = await requestCapture(sourceIndex ?? -1, windowName);
+ const result = await requestCapture(sourceIndex);
```

**`mcp-server.ts`** — List sources first, find the index, then capture:
```diff
  server.tool('capture_screenshot', ..., {
-     window_name: z.string()
+     source_index: z.number().describe('Source index from list_sources (e.g. 4)')
  },
- async ({ window_name }) => {
-     const data = await post('/api/screenshots/capture', { sourceIndex: -1, windowName: window_name });
+ async ({ source_index }) => {
+     const data = await post('/api/screenshots/capture', { sourceIndex: source_index });
```

**No other files need changes.** The frontend WS handler already reads from the cached Zustand store and looks up `sources[sourceIndex].id` — that's correct.

### Why `sourceIndex` Works

The source list is cached in the Zustand store and refreshed every 30 seconds (or when `list_sources` is called). The AI calls `list_sources` → picks an index → calls `capture_screenshot(source_index=4)`. The frontend handler reads `store.sources[4].id` and passes it directly to `captureSource()`. No fuzzy matching, no name ambiguity, no race condition.

---

## 3. Optimizations — Where to Begin

### 3.1 Test `capturePage()` / `withScreenshot` End-to-End
Built but untested. The pipeline is: `MCP tool` → `POST /api/app-screenshot` → WS `app:capture` → frontend calls `window.electronAPI.capturePage()` → WS `app:capture:result` → MCP response with image. Test with:
```bash
curl -s -X POST http://localhost:3100/api/app-screenshot | jq
```

### 3.2 Dual Capture Worker "Ready" Messages
React StrictMode double-mounts the capture worker, registering `onCaptureRequest` twice → possible duplicate responses. Fix: add a `useRef` guard in the worker's `useEffect`.

### 3.3 Gallery Loads All PNGs as Base64
`list-outputs` reads every file into memory. With 50+ screenshots this is slow. Fix: return metadata only, serve thumbnails lazily via a dedicated endpoint.

### 3.4 Stream Lifecycle in Live Preview
Each capture opens/closes a `getUserMedia` stream. Under 500ms live preview, that's 2 stream rounds/second. Fix: keep the stream alive for the selected source, tear down only on source change or stop.

---

## 4. Step-by-Step: Get to Zero Errors

```bash
# 1. Apply the 3-file fix from §2

# 2. Build
cd D:\Projects\MinitoolboxMCP
cd backend  && npx tsc && cd ..
cd electron && npx tsc && cd ..

# 3. Start
npm run dev
# Wait for "WebSocket client connected (2 total)"

# 4. Test capture pipeline
curl -s -X POST http://localhost:3100/api/sources/list | jq
# Pick an index from the list, e.g. 4
curl -s -X POST http://localhost:3100/api/screenshots/capture \
  -H "Content-Type: application/json" \
  -d '{"sourceIndex": 4}' | jq
# Should return: { dataUrl, width, height, name, savedPath }

# 5. Test app self-screenshot
curl -s -X POST http://localhost:3100/api/app-screenshot | jq
# Should return: { ok, savedPath, dataUrl, width, height }

# 6. Test all MCP tools
# list_sources → select_source → navigate_page → execute_command → capture_screenshot
```

---

## 5. How to Start & Test the API

### Start
```bash
cd D:\Projects\MinitoolboxMCP && npm run dev
```
Runs Vite (:5173) + Backend (:3100) + Electron concurrently.

### REST Endpoints (all POST, JSON body)

| Endpoint | Body | What it does |
|----------|------|-------------|
| `/api/health` | `{}` | Returns uptime + timestamp |
| `/api/navigate` | `{"page":"gallery"}` | Switches UI page |
| `/api/execute-command` | `{"command":"capture.refresh"}` | Runs a keyboard command |
| `/api/sources/list` | `{}` | Returns indexed window list via WS relay |
| `/api/sources/select` | `{"windowName":"Unity"}` | Selects window in dropdown via WS relay |
| `/api/screenshots/capture` | `{"sourceIndex":4}` | Captures target window by index (**currently broken**) |
| `/api/app-screenshot` | `{}` | Captures app's own UI via `capturePage()` (**untested**) |

### MCP Server
Configured at `~/.gemini/antigravity/mcp_config.json`. Runs `node D:/Projects/MinitoolboxMCP/backend/dist/mcp-server.js` over stdio.

---

## 6. Issues & Strategies

### Issue 1: Capture Signature Mismatch
**Fix:** 3 lines in `screenshot.routes.ts` — remove `windowName`, pass only `sourceIndex`. See §2.

### Issue 2: `capturePage()` Untested
**Strategy:** Test `/api/app-screenshot` with curl. If it fails, debug in order: preload bridge → IPC handler → WS handler → WS result resolver. Each layer is already wired.

### Issue 3: MCP Tool Still Accepts `window_name` String
**Strategy:** Change schema to `source_index: z.number()`. The AI must call `list_sources` first. This eliminates all fuzzy matching and name ambiguity.

### Issue 4: Source List Could Be Stale
**Strategy:** The 30-second auto-refresh is sufficient for normal use. For MCP, `list_sources` always refreshes first. If needed, add a `force_refresh` param to `capture_screenshot` that triggers a refresh before capture.

---

## 7. Architecture

### Data Flow
```
AI ──stdio──→ MCP Server ──HTTP POST──→ Backend (Fastify :3100) ──WS broadcast──→ Frontend (React)
                                                                                      │
                                                                                      IPC
                                                                                      │
                                                                                  Electron Main
```

### Two Screenshot Paths

| Path | When | How | Status |
|------|------|-----|--------|
| App self-screenshot | `withScreenshot` after MCP tool | `capturePage()` via IPC — no desktopCapturer | Wired, untested |
| Target window capture | `capture_screenshot` tool | `desktopCapturer` → `captureSource(id)` via worker | Broken (§2 fix) |

### Files Modified This Session

| Layer | File | Key Changes |
|-------|------|-------------|
| MCP | `backend/src/mcp-server.ts` | 5 tools, `withScreenshot`, `captureAppScreenshot`, stdout redirect |
| Backend | `backend/src/websocket.ts` | `requestCapture(sourceIndex)`, `requestAppCapture()` |
| Backend | `backend/src/routes/screenshot.routes.ts` | `/api/app-screenshot`, capture route (broken hybrid) |
| Backend | `backend/src/types/index.ts` | `app:capture`, `app:capture:result` WS types |
| Frontend | `frontend/src/hooks/useWebSocket.ts` | `handleAppCapture`, `handleCaptureRequest(sourceIndex)` |
| Frontend | `frontend/src/store/useAppStore.ts` | Live auto-stop, priority matching |
| Frontend | `frontend/src/components/MenuBar.tsx` | VS Code menu, page-aware |
| Frontend | `frontend/src/types/electron.ts` | `capturePage()` type |
| Electron | `electron/src/main.ts` | `capture-page` IPC handler |
| Electron | `electron/src/preload.ts` | `capturePage()` bridge |

---

## 8. Quick Wins & Feature Ideas

### Quick Wins

| Win | Time | Impact |
|-----|------|--------|
| Fix capture signature (§2) | 10 min | Unblocks `capture_screenshot` MCP tool |
| Change MCP schema to `source_index` | 5 min | Eliminates fuzzy matching entirely |
| Test `/api/app-screenshot` | 5 min | Validates `withScreenshot` pipeline |
| Health check in status bar | 20 min | Green/red dot showing backend connectivity |

### Feature Ideas
- **Screenshot diff** — new MCP tool comparing two saved screenshots, highlighting changes
- **Window watcher** — background polling that notifies the AI when a new window appears
- **Annotation overlay** — MCP tool draws arrows/boxes on screenshots before saving
- **Batch capture** — capture multiple windows in one tool call, useful for multi-monitor setups
