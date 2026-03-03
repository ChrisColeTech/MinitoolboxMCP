# MinitoolboxMCP — Screenshot Tool Requirements

## Vision

MinitoolboxMCP is an MCP (Model Context Protocol) server that exposes a suite of developer-utility tools. The **first tool** is a **Screenshot Capture Tool** that uses Electron to capture the screen content of a target Windows application by its process name — giving AI agents visual context of running applications like Unity, Blender, etc.

## Why Electron?

Native screenshot APIs (e.g. Win32 `PrintWindow`, `BitBlt`) are unreliable for GPU-accelerated windows (DirectX/OpenGL/Vulkan). Electron's `desktopCapturer` API leverages Chromium's media pipeline, which is battle-tested for screen capture and works with hardware-accelerated content.

## Architecture

The project is split into two packages at the project root:

```
MinitoolboxMCP/
├── electron/          ← Electron main process (capture engine, tray, IPC)
│   ├── src/
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/          ← React + Vite UI (source picker, preview, controls)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── 00-REQUIREMENTS.md
└── package.json       ← root workspace (optional)
```

### How It Works

1. **Electron** runs as a desktop app with a system tray icon.
2. The Electron `BrowserWindow` loads the **React frontend** (Vite dev server in dev, built assets in prod).
3. The frontend communicates with Electron's main process via a **preload bridge** (`contextBridge`).
4. `desktopCapturer.getSources()` enumerates windows; the user (or MCP tool call) selects one by name.
5. The selected window is streamed via `getUserMedia` with `chromeMediaSource: 'desktop'`.
6. A frame is captured to PNG and either displayed in the UI or returned to the MCP caller.

### Tray Behavior

- The app minimizes to the **system tray** instead of closing.
- A tray icon + context menu allows restore / quit.
- This keeps the Electron process warm for fast MCP tool responses.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Capture a screenshot of any named Windows process | **Must** |
| 2 | Return the screenshot as base64 PNG to the MCP caller | **Must** |
| 3 | Tray-minimized app with a React UI for manual control | **Must** |
| 4 | Optional resize / crop parameters | **Should** |
| 5 | Minimal capture latency — keep Electron warm via tray | **Should** |
| 6 | Clean MCP tool schema with descriptive parameter docs | **Must** |

## Phased Approach

### Phase 1 — Proof of Concept

- Scaffold Electron + React (Vite) project structure.
- Electron loads the React dev server in a visible `BrowserWindow`.
- React UI: dropdown of window sources, live video preview, capture button.
- Capture saves a PNG to disk.
- **Success:** We can see a target app's screen inside the Electron window and save a screenshot.

### Phase 2 — Tray + Polish

- Minimize-to-tray behavior.
- Error handling, status indicators.

### Phase 3 — MCP Integration

- MCP server wired to Electron's capture pipeline.
- `screenshot` tool schema, end-to-end test.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Electron | Electron (latest stable — v40) |
| Frontend | React + TypeScript + Vite |
| MCP Server | Node.js + `@modelcontextprotocol/sdk` |
| IPC | Electron `contextBridge` / `ipcRenderer` ↔ `ipcMain` |
