---
paths:
  - "frontend/src/**"
---

# Frontend Rules (React / TypeScript / Tailwind)

## Locale-Neutral Date Formatting

```typescript
// CORRECT — browser uses user's own locale automatically
new Date(timestamp).toLocaleString()
new Date(timestamp).toLocaleDateString()
new Date(timestamp).toLocaleTimeString()

// WRONG — hardcodes Dutch locale
new Date(timestamp).toLocaleString('nl')
new Date(timestamp).toLocaleString('nl-NL')

// WRONG — hardcodes any locale
new Date(timestamp).toLocaleString('en-US')
```

This app is intended for international users. Never pass a locale parameter to any `toLocale*` method.

## Auth

- Token stored in localStorage under key `unstuckarr_token`
- Always check `isAuthenticated()` from `lib/auth.ts` — it validates the token AND checks expiry
- Never read the raw token and assume it's valid
- On 401 response from API: call `clearToken()` and redirect to `/login`

## API Calls

Use the typed helpers in `lib/api.ts`. Never use raw `fetch` in components. The API client handles:
- Auth header injection
- 401 detection and redirect
- Base URL (same-origin in production, proxied in dev)

## Component Structure

- Pages in `src/pages/` — route-level components
- Reusable components in `src/components/<domain>/`
- Hooks in `src/hooks/` — one hook per concern (useWebSocket, useApi, usePolling)
- No business logic in components — extract to hooks

## Tailwind

- Use Tailwind utilities only — no inline `style={{}}` props
- Follow the existing dark-themed color scheme (slate-900 backgrounds, etc.)
- Use `shadcn/ui` components where available (Button, Card, Badge, etc.)

## WebSocket (Logs page)

The WS connection lives in `hooks/useWebSocket.ts` with auto-reconnect. When adding new log consumers:
- Reuse the existing hook, do not open additional WS connections
- Messages are JSON: `{ level, message, run_id, timestamp }`

## TypeScript

- Strict mode enabled — no `any` unless genuinely unavoidable
- Define types for all API responses in `lib/api.ts` or co-located with the component
- Use `interface` for object shapes, `type` for unions/aliases
