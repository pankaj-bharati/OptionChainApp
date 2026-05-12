# Tech Stack

## Architecture

Monorepo with two independent packages — a Node.js backend and a React frontend — coordinated from the root via `concurrently`.

## Backend (`/server`)

- **Runtime**: Node.js (CommonJS — uses `require`)
- **Framework**: Express 4
- **HTTP client**: axios with `axios-cookiejar-support` + `tough-cookie` for persistent browser-like sessions
- **HTML parsing**: cheerio (available but not actively used in current routes)
- **CORS**: enabled globally via the `cors` middleware
- **Port**: 3000 (hardcoded)

### Session Strategy
NSE blocks direct API calls without a valid browser session. The server:
1. GETs `nseindia.com` and `nseindia.com/option-chain` to warm up cookies
2. Stores cookies in a `CookieJar` that persists across requests
3. Refreshes the session every 10 minutes and on 401/403 responses
4. Uses a single in-flight `sessionRefreshPromise` to prevent concurrent refreshes

### Retry / Caching
- Retries with delays `[1000, 2000, 5000, 10000]` ms on failure
- Falls back to the last successful in-memory response if all retries fail
- Stale cache responses include `X-Data-Source`, `X-Cache-Age`, `X-Cache-Stale` headers

## Frontend (`/client`)

- **Framework**: React 18 (functional components + hooks only — no class components)
- **Build tool**: Vite 4 with `@vitejs/plugin-react`
- **Router**: React Router v6 (`BrowserRouter`) — page-based routing with auth guards
- **UI library**: Semantic UI React (`semantic-ui-react` + `semantic-ui-css`) — provides components for layout, forms, tables, menus, messages, loaders, statistics, and lists
- **HTTP client**: axios (with a global response interceptor for mid-session 401 detection)
- **Auth state**: `AuthContext.jsx` — React Context + `useAuth()` hook; session check, interceptor, and logout live here
- **PWA**: `vite-plugin-pwa` with Workbox `NetworkFirst` strategy for API routes
- **Styling**: Semantic UI CSS for base styles + `App.css` for project-specific overrides (table cell colours, ATM row highlight, countdown SVG, login page layout). No per-component CSS files.
- **State**: React `useState` / `useEffect` only — no Redux or external state manager
- **Persistence**: `localStorage` for OI history and window size preference

### Semantic UI React component mapping

| UI area | SUI component(s) used |
|---|---|
| App-level navigation bar | `Menu`, `Dropdown`, `Button`, `Label` |
| Login / Reset forms | `Form`, `Form.Field`, `Button`, `Message`, `Segment`, `Header` |
| Reset page steps | `Step`, `Step.Group`, `Icon`, `Divider` |
| Summary boxes | `Statistic`, `Statistic.Group`, `Segment` |
| Option chain table | `Table`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Cell` |
| OI history lists | `Grid`, `List`, `Segment`, `Header` |
| Loading indicators | `Loader` |

### Styling conventions
- Semantic UI CSS (imported in `main.jsx`) provides the base reset and typography — do **not** import normalize.css separately.
- `App.css` contains only styles SUI cannot express: ATM row tint, OI change colours, strike/IV/volume cell styles, countdown SVG colours, and the login page full-viewport wrapper.
- `style.css` contains only global CSS variables and body defaults.
- Color convention for OI changes: positive → `.oi-positive` (green `#21ba45`), negative → `.oi-negative` (red `#db2828`).

### Routing
Three client-side routes are defined in `App.jsx`:
- `/login` — `LoginPage` (public, redirects to `/` if already authenticated)
- `/reset-password` — `ResetPasswordPage` (public, redirects to `/` if already authenticated)
- `/` — `HomePage` (protected, redirects to `/login` if unauthenticated)

### Dev Server
Vite dev server proxies nothing — the client calls `http://localhost:3000` directly.

## Common Commands

```bash
# Install all dependencies (root + server + client)
npm run install-all

# Run both server and client in development (concurrently)
npm run dev          # from repo root

# Run server only
npm run server       # from repo root
# or
npm start            # from /server (node server.js)
npm run dev          # from /server (nodemon server.js)

# Run client only
npm run client       # from repo root
# or
npm run dev          # from /client (vite)
npm run build        # from /client (production build)
npm run preview      # from /client (preview production build)
```

## API Endpoints (server)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/option-chain?expiry=<date>` | Fetch NIFTY option chain for a given expiry |
| GET | `/api/expiry-dates` | List available expiry dates |
| GET | `/health` | Server health + last fetch time |
| POST | `/api/refresh-session` | Manually trigger NSE session refresh |
