# hivemind-ui

A sleek RAG chat UI — index any website, ask questions, get cited answers.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [SvelteKit](https://kit.svelte.dev/) (Svelte 5, runes) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | [shadcn-svelte](https://shadcn-svelte.com/) (bits-ui) |
| Icons | Lucide Svelte |
| Data fetching | [TanStack Query for Svelte](https://tanstack.com/query/latest) |
| Markdown | marked |
| Package manager | [Bun](https://bun.sh/) |
| Build tool | Vite |

---

## Features

- **iMessage-style chat thread** — user messages right-aligned in a pink-to-violet gradient bubble; AI responses left-aligned with a Sparkles avatar.
- **Cited answers** — each AI response links its sources as pill badges that resolve scraped file paths (e.g. `scraped_websites/support_squadcast_com/adding_a_schedule.txt`) back to the real URL (`https://support.squadcast.com/adding-a-schedule`).
- **Website indexing panel** — submit any public URL to trigger a background crawl; 409 (already indexed) is handled gracefully and the URL is accepted as a scope.
- **Conversation scope** — once a site is crawled, all subsequent queries in that conversation are scoped to that site's namespace.
- **Multi-turn conversations** — backend `conversation_id` is persisted per conversation and re-sent on every message for full context continuity.
- **Auto-title** — the first user message (up to 50 chars) becomes the conversation title automatically.
- **FAQ chips** — TanStack Query fetches auto-generated FAQs from the backend; up to 5 are shown as clickable chips above the input bar.
- **Sidebar FAQ list** — all FAQs are also listed in the sidebar as suggestion buttons.
- **Health indicator** — a live Wifi icon in the header reflects the backend health (`healthy` / `degraded` / offline), polled every 60 seconds.
- **Offline / waking-up recovery** — network errors show a "Server is waking up" banner with a one-click retry that restores the unsent message.
- **Not-indexed error** — a 404 from the query API surfaces a human-readable banner instead of an error message in the thread.
- **Responsive sidebar** — collapses to a slide-over drawer on mobile with an overlay backdrop.
- **Markdown rendering** — AI responses are rendered as structured prose (headings, lists, code blocks, bold, links) with custom prose styles scoped to `.ai-bubble`.
- **Auto-growing textarea** — the input expands as the user types, up to 144 px.
- **Keyboard shortcut** — `Enter` sends, `Shift+Enter` inserts a newline.

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 20 (used by Bun internally)

### Install

```bash
bun install
```

### Development

```bash
bun run dev
```

The app is served at `http://localhost:5173` by default.

### Build

```bash
bun run build
```

### Preview production build

```bash
bun run preview
```

### Type-check

```bash
bun run check
```

---

## Running tests

Install Vitest if it is not yet present:

```bash
bun add -D vitest
```

Run all tests:

```bash
bunx vitest run
```

Watch mode:

```bash
bunx vitest
```

---

## Project structure

```
hivemind/
├── src/
│   ├── lib/
│   │   ├── api.ts              # Typed fetch wrappers for all backend endpoints
│   │   ├── chat.svelte.ts      # Svelte 5 rune-based chat store (conversations, messages)
│   │   ├── source-url.ts       # sourceHref / sourceLabel helpers (scraped path to URL)
│   │   ├── api.test.ts         # Vitest unit tests for api.ts
│   │   ├── chat.test.ts        # Vitest unit tests for the chat store
│   │   ├── sourceUrl.test.ts   # Vitest unit tests for source-url.ts
│   │   ├── components/         # shadcn-svelte UI primitives (Button, Badge, Textarea, ...)
│   │   ├── hooks/              # Svelte hooks
│   │   ├── utils.ts            # cn() class-name helper
│   │   └── index.ts            # Barrel re-exports
│   └── routes/
│       ├── +layout.svelte      # QueryClientProvider wrapper
│       ├── +page.svelte        # Main chat page (sidebar + chat thread + input bar)
│       └── layout.css          # Global styles and font imports
├── .doc/
│   └── API_INFO.md             # Backend API reference
├── package.json
├── svelte.config.js
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## API integration

The frontend communicates exclusively with the hosted backend at:

```
https://hivemind-2f75.onrender.com
```

All API calls are centralised in `src/lib/api.ts`.

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `fetchHealth` | GET | `/health` | Deep health check; returns `healthy` or `degraded` |
| `sendQuery` | POST | `/api/v1/query` | Ask a question; returns answer, sources, and conversation_id |
| `fetchFAQs` | GET | `/api/v1/faqs` | Fetch auto-generated FAQs (up to 5) |
| `crawlURL` | POST | `/api/v1/crawl` | Submit a URL for background crawling and indexing |

### Error handling

All non-2xx responses are thrown as `ApiError` instances that carry a `status` code. The UI handles the following cases explicitly:

- **404** from `/api/v1/query` — the requested URL has not been indexed yet.
- **409** from `/api/v1/crawl` — the URL is already indexed; the UI accepts this silently and scopes the conversation.
- **Network error (TypeError)** — server is offline or still waking up from the Render free-tier cold start.

### Query scoping

When a user indexes a website, its URL is stored on the active conversation via `chat.setScopeUrl`. All subsequent `sendQuery` calls in that conversation include `url` in the request body, which tells the backend to search only that site's Pinecone namespace.

### Conversation continuity

The `conversation_id` UUID returned by the first `sendQuery` response is stored on the conversation and sent with every follow-up message, giving the LLM full history access.

---

## Screenshots

_Add screenshots here once the UI is deployed._

| View | Screenshot |
|---|---|
| Empty state | _(placeholder)_ |
| Chat thread with sources | _(placeholder)_ |
| Indexing panel — crawling | _(placeholder)_ |
| Indexing panel — already indexed | _(placeholder)_ |
| Mobile sidebar | _(placeholder)_ |

---

## License

Private — all rights reserved.
