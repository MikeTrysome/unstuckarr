---
name: frontend
description: Preview and test the Unstuckarr frontend UI using the Claude Preview MCP. Use when the user wants to see the UI, verify a visual change, or test a flow in the browser.
disable-model-invocation: false
allowed-tools: mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_stop, mcp__Claude_Preview__preview_screenshot, mcp__Claude_Preview__preview_click, mcp__Claude_Preview__preview_fill, mcp__Claude_Preview__preview_snapshot, mcp__Claude_Preview__preview_list, mcp__Claude_Preview__preview_logs, mcp__Claude_Preview__preview_console_logs, mcp__Claude_Preview__preview_network, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_inspect, mcp__Claude_Preview__preview_resize, Bash, Read, Edit
---

# Frontend Preview & Testing

Use the Claude Preview MCP to start the Vite dev server and interact with the Unstuckarr UI.

## Project info

- **Frontend dir:** `unstuckarr/frontend/`
- **Dev server:** `npm run dev` → runs on `http://localhost:5173`
- **Backend:** must be running on port 7676 for API calls to work (Unraid Docker container)
- **Framework:** React + TypeScript + Vite + Tailwind CSS

## Steps

### 1. Start the preview

```bash
cd unstuckarr/frontend && npm run dev
```

Then call `preview_start` with URL `http://localhost:5173`.

### 2. Take a screenshot

Call `preview_screenshot` to see the current state of the UI.

### 3. Navigate & interact

- `preview_click` — click buttons, links, nav items
- `preview_fill` — type into inputs
- `preview_snapshot` — get the DOM snapshot (useful for debugging)
- `preview_eval` — run JS in the page context

### 4. Check for errors

- `preview_console_logs` — check for JS errors
- `preview_network` — check for failed API requests

### 5. Stop when done

Call `preview_stop` to shut down the preview session.

## Notes

- The dev server proxies `/api` to `http://localhost:7676` (configured in `vite.config.ts`)
- Login page is at `/login` — use stored credentials if needed to get past auth
- If the backend is not reachable, API calls will fail with 502 but the UI still renders
- Hot reload is active — file saves reflect immediately without restarting
