# Session 3 — Lessons Learned & Handoff

> **Date:** 2026-03-03  
> **Focus:** Fix capture pipeline, production build, MCP tool verification  
> **Commits:** `b9486bc` → `bf4b259` → `3620a5c` → `d5304e7`

---

## §1 What We Accomplished

### Bugs Fixed
1. **`screenshot.routes.ts` signature mismatch** — Was passing both `sourceIndex` and `windowName` to `requestCapture()`, but the function only accepts `sourceIndex`. Removed `windowName`.
2. **MCP schema wrong type** — `capture_screenshot` expected `window_name: string` with fuzzy matching. Changed to `source_index: z.number()` per §6 of `02-LESSONS-LEARNED.md`.
3. **`captureAppScreenshot()` silently failing** — Checked `!data.ok` but the WS response returns `{ id, savedPath, width, height }` — no `ok` field. `!undefined` is `true`, so `withScreenshot` **never worked**. Changed to `data.error || !data.savedPath`.
4. **Stream leak in `CaptureWorkerPage.tsx`** — `getUserMedia` stream was only stopped in the success path. On error (e.g. `Video load timeout`), tracks leaked and Windows showed persistent yellow sharing borders. Moved cleanup to `finally` block.
5. **Health dot wrong colors** — Used Tailwind defaults (`bg-emerald-400`) not in the theme. Changed to `bg-ok`/`bg-err`/`bg-warn`.
6. **Prod white screen** — Vite built with absolute paths (`/assets/...`) which fail under Electron's `file://` protocol. Added `base: './'` to emit relative paths.

### Features Added
- **Health check dot** — Polls `/api/health` every 15s. Green = API reachable, red = unreachable. Independent of WebSocket status.
- **Production build pipeline** — `electron-builder` configured with `extraResources` for frontend + backend. `npm run pack` produces an unpacked Windows build; `npm run dist` produces a portable exe.
- **Backend auto-lifecycle** — In prod, Electron forks `backend/dist/server.js` on startup and sends `SIGTERM` on `will-quit`. In dev, backend runs separately via `concurrently`.

### All 5 MCP Tools Verified

| Tool | Status | `withScreenshot` | Notes |
|------|--------|------------------|-------|
| `list_sources` | ✅ | No | Text-only response |
| `capture_screenshot` | ✅ | No | Returns target window image |
| `select_source` | ✅ | ✅ App UI | Updates dropdown + `captureOnce` |
| `navigate_page` | ✅ | ✅ App UI | Both capture and gallery work |
| `execute_command` | ✅ | ✅ App UI | Tested `capture.refresh`, `app.toggle-devtools`, `app.hide-window`, `app.show-window` |

### Tray Behavior Verified
- App hidden → `capture_screenshot` still captures target windows ✅
- App hidden → `withScreenshot` silently skips (no crash, no error) ✅
- App hidden → `list_sources` works normally ✅
- `app.show-window` restores everything + `withScreenshot` resumes ✅

---

## §2 What Work Remains

### Must-Do
- [ ] **Code signing** — `signAndEditExecutable: false` is a workaround. Need Windows Developer Mode or a signing certificate via `WIN_CSC_LINK` to enable proper signing.
- [ ] **NSIS installer** — Currently building portable exe only. Add NSIS target once code signing works.
- [ ] **Gallery broken images** — Some `app-*` prefixed thumbnails in the gallery show broken image icons. Root cause: the gallery reads images from disk but the `app-screenshot` endpoint saves to a different path in prod (`resources/outputs/` vs `outputs/`).

### Should-Do
- [ ] **Unified `capture_screenshot` parameter** — Consider making `source_index` optional: omit to capture app UI via `capturePage()`, provide index to capture a target window.
- [ ] **Error boundary for capture worker** — `CaptureWorkerPage` silently swallows errors. Add an IPC error channel back to main process for logging.
- [ ] **Prod outputs directory** — In prod, outputs go to `resources/outputs/` inside the install dir, which may be read-only. Should default to `%APPDATA%/MinitoolboxMCP/outputs/`.

### Nice-to-Have
- [ ] Screenshot diff between consecutive captures
- [ ] Window watcher — auto-capture on window state change
- [ ] Annotation overlay
- [ ] Batch capture — all windows at once

---

## §3 Optimization Prime Suspects

### 1. DXGI Duplication Failures
**Symptom:** `Failed to capture 5 frames within 500 milliseconds` + `Duplication failed` in electron logs.  
**Root Cause:** Electron's `desktopCapturer.getSources()` opens a DXGI output duplication session. On Windows, only one duplicator per output is allowed. Rapid successive calls conflict.  
**Strategy:** Cache sources for 5+ seconds. Avoid calling `getSources()` inside the capture path — separate listing from capturing.

### 2. `Video load timeout` in Capture Worker
**Symptom:** `getUserMedia` stream is obtained but the video element never fires `onloadeddata` within 5s.  
**Root Cause:** DXGI session is stale or the window has been minimized/closed since `getSources()` was called.  
**Strategy:** Reduce timeout to 3s (fail fast), add a retry-once with a fresh `getSources()` call, and validate the source still exists before attempting capture.

### 3. Backend Memory on Long-Running Sessions
**Symptom:** Not yet observed, but the pending request `Map` in `websocket.ts` has no TTL.  
**Root Cause:** If a WS response never arrives (e.g. capture worker crashes), the pending entry leaks.  
**Strategy:** Add a 30s TTL sweep that rejects stale pending requests.

### 4. Gallery Thumbnail Loading
**Symptom:** Gallery reads all PNGs as base64 data URLs via `list-outputs` IPC.  
**Root Cause:** Each screenshot is ~1–2MB as base64. With 20+ screenshots, the IPC message becomes huge.  
**Strategy:** Serve thumbnails via a local HTTP endpoint with lazy loading, or generate small thumbnail files on save.

---

## §4 Step-by-Step: Getting the App Fully Working

### Development Mode
```bash
# 1. Install all dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd electron && npm install && cd ..

# 2. Start everything (one command)
npm run dev

# 3. Verify
# - Vite should show "ready in Xms" on http://localhost:5173
# - Backend should show "Server listening on http://127.0.0.1:3100"
# - Electron window should open with the capture page
# - Status bar should show green health dot + green WS dot
```

### Production Build
```bash
# 1. Build all layers
npm run build

# 2. Package (unpacked dir for testing)
npm run pack
# Output: release/win-unpacked/MinitoolboxMCP.exe

# 3. Run the prod build
./release/win-unpacked/MinitoolboxMCP.exe
# Backend auto-starts, frontend loads from resources/frontend/
```

### MCP Server Configuration
Add to your client's MCP config:
```json
{
  "minitoolbox": {
    "command": "node",
    "args": ["D:/Projects/MinitoolboxMCP/backend/dist/mcp-server.js"]
  }
}
```
The MCP stdio server connects to the backend on `:3100`. The backend must be running (either via `npm run dev` or via the prod Electron app).

---

## §5 How to Start & Test the API

### Quick Health Check
```bash
curl -s -X POST http://localhost:3100/api/health | jq
```

### List Available Windows
```bash
curl -s -X POST http://localhost:3100/api/sources/list | jq
```

### Capture a Window (by index from list)
```bash
curl -s -X POST http://localhost:3100/api/screenshots/capture \
  -H "Content-Type: application/json" \
  -d '{"sourceIndex": 0}' | jq "del(.dataUrl)"
```

### Capture App's Own UI
```bash
curl -s -X POST http://localhost:3100/api/app-screenshot | jq "del(.dataUrl)"
```

### Navigate the Frontend
```bash
curl -s -X POST http://localhost:3100/api/navigate \
  -H "Content-Type: application/json" \
  -d '{"page": "gallery"}'
```

### Execute a Command
```bash
curl -s -X POST http://localhost:3100/api/execute-command \
  -H "Content-Type: application/json" \
  -d '{"command": "app.toggle-devtools"}'
```

### MCP Tool Test (via chat)
```
list_sources → should return numbered list
capture_screenshot(source_index=0) → should return target window image
navigate_page(page="gallery") → should return app UI screenshot of gallery
```

---

## §6 Known Issues & Strategies

### Issue 1: DXGI Symlink Error During Build
**Symptom:** `electron-builder` fails with `Cannot create symbolic link : A required privilege is not held`  
**What:** The `winCodeSign` 7z archive contains macOS dylib symlinks that Windows can't create without Developer Mode.  
**Current Fix:** `signAndEditExecutable: false` + `forceCodeSigning: false` in `electron-builder.json`.  
**Strategy A:** Enable Windows Developer Mode → Settings → For Developers → Developer Mode.  
**Strategy B:** Run the build from an elevated (admin) terminal.  
**Strategy C:** Set `WIN_CSC_LINK` to a self-signed cert to bypass the winCodeSign extraction entirely.

### Issue 2: GPU Disk Cache Errors in Prod
**Symptom:** `Unable to move the cache: Access is denied` + `Gpu Cache Creation failed: -2`  
**What:** Electron tries to write GPU shader caches to the exe's directory, which may be read-only.  
**Strategy A:** Set `app.setPath('cache', ...)` to `%APPDATA%/MinitoolboxMCP/cache/` before `app.whenReady()`.  
**Strategy B:** Pass `--disable-gpu-shader-disk-cache` as a Chromium flag via `app.commandLine.appendSwitch()`.  
**Strategy C:** Ignore — the errors are non-fatal and the app works fine without the cache.

### Issue 3: Prod Outputs Path
**Symptom:** Screenshots save to `resources/outputs/` which is inside the install directory.  
**What:** In prod, `getOutputsDir()` resolves relative to `app.getPath('exe')`, landing inside the packaged folder.  
**Strategy:** In prod mode, default to `app.getPath('userData') + '/outputs/'` which goes to `%APPDATA%/MinitoolboxMCP/outputs/`.

### Issue 4: WS Relay Timeout on Slow Captures
**Symptom:** MCP tool returns "Request timed out — is the Electron app running?" even when it is.  
**What:** The `waitForResponse()` in `websocket.ts` has a 10s timeout. DXGI sometimes takes 5–8s to initialize.  
**Strategy A:** Increase timeout to 15s.  
**Strategy B:** Add a progress heartbeat from the capture worker ("capture in progress…") to reset the timeout.  
**Strategy C:** Cache the DXGI session across captures instead of creating a new one each time.

---

## §7 Architecture & Quick Wins

### Current Data Flow
```
MCP stdio → POST :3100 → WS broadcast → Electron renderer → IPC → main process
                                                                      ↓
                                              desktopCapturer (target) OR capturePage (app)
                                                                      ↓
                                              WS response ← renderer ← IPC result
                                                    ↓
                                              MCP returns image to AI agent
```

### Quick Win Ideas (1–2 hours each)

1. **Auto-select last source** — Persist `selectedSourceId` to localStorage so the dropdown remembers your pick across restarts.

2. **Keyboard shortcut overlay** — The `?` shortcut is planned but not implemented. Add a modal that lists all registered commands from `keyboardRegistry`.

3. **Toast notifications** — Status bar messages disappear too fast. Add a toast queue that stacks recent events (saved screenshot, error, etc.) with auto-dismiss.

4. **Gallery delete** — Right-click context menu on gallery thumbnails with "Delete" and "Open folder" actions.

5. **Portable exe artifact name** — Currently builds to a generic name. The `electron-builder.json` already has `artifactName: "${productName}-${version}-portable.exe"` — run `npm run dist` to produce a named distributable.

6. **MCP tool: `capture_screenshot` with optional `source_index`** — If omitted, capture the app's own UI via `capturePage()`. Eliminates the need for a separate tool. (~10 lines in `mcp-server.ts`).

### Bigger Features (half-day each)

1. **Screenshot diff** — Compare two captures pixel-by-pixel, highlight changes. Useful for visual regression testing of apps being developed.

2. **Window watcher** — Subscribe to a source and auto-capture on window focus/resize events. Requires a polling loop in the main process.

3. **Batch capture** — Capture all windows at once, save as a timestamped folder. Useful for bug reports.

4. **Annotation overlay** — Draw arrows, boxes, text on screenshots before saving. Requires a canvas overlay component.
