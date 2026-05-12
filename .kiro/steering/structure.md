# Project Structure

```
OptionChainApp-kiro-version/
├── package.json              # Root — scripts only (concurrently), no app code here
├── NodeNSE.cmd               # Windows shortcut to launch the app
│
├── server/                   # Node.js backend (CommonJS)
│   ├── server.js             # Single-file server: Express app, session mgmt, API routes
│   ├── auth.json             # Credentials file (auto-created on first run)
│   └── package.json
│
└── client/                   # React frontend (ES modules)
    ├── index.html            # Vite entry point
    ├── vite.config.js        # Vite + React + PWA plugin config
    ├── package.json
    └── src/
        ├── main.jsx          # React root — mounts <BrowserRouter> + <AuthProvider> + <App>
        ├── App.jsx           # Router shell — defines routes and auth guards (RequireAuth / RedirectIfAuthenticated)
        ├── AuthContext.jsx   # Auth state, session check on mount, axios interceptor, logout handler
        ├── App.css           # App-level and component styles
        ├── style.css         # Global base styles (normalize, CSS vars, body defaults)
        ├── pages/
        │   ├── LoginPage.jsx          # /login — renders LoginForm, redirects to / on success
        │   ├── ResetPasswordPage.jsx  # /reset-password — two-step password reset flow
        │   └── HomePage.jsx           # / (protected) — full option chain UI with all data state
        ├── components/
        │   ├── Header.jsx       # Title, window selector, expiry selector, countdown ring, Logout button
        │   ├── LoginForm.jsx    # Password input form; accepts resetPasswordLink prop for router navigation
        │   ├── Summary.jsx      # Aggregate ΔOI boxes for calls and puts
        │   ├── OptionTable.jsx  # Strike-by-strike option chain table
        │   └── OIHistory.jsx    # Scrollable ΔOI history lists
        └── utils/
            └── format.js     # fmtInt (en-IN locale) and fmtFloat (2 dp) helpers
```

## Conventions

### Routing
The app uses React Router v6 (`BrowserRouter`). Routes are defined in `App.jsx`:

| Path | Page | Guard |
|---|---|---|
| `/` | `HomePage` | `RequireAuth` — redirects to `/login` if unauthenticated |
| `/login` | `LoginPage` | `RedirectIfAuthenticated` — redirects to `/` if already logged in |
| `/reset-password` | `ResetPasswordPage` | `RedirectIfAuthenticated` — redirects to `/` if already logged in |
| `*` | — | Catch-all redirects to `/` |

### Auth state ownership
Auth state (`authStatus`, `sessionExpired`, `credentialsFilePath`) lives in `AuthContext.jsx` and is consumed via the `useAuth()` hook. The session check on mount, axios 401 interceptor, and logout handler all live in `AuthContext`.

### Page state ownership
Option chain data state (`optionChainData`, `expiryDates`, `selectedExpiry`, `history`, etc.) lives in `HomePage.jsx`. Pages own their own data-fetching state; they do not receive it from `App.jsx`.

### Component conventions
- Components in `components/` are purely presentational — they receive data and callbacks as props, they do not fetch or store state themselves.
- Use Semantic UI React components for all UI elements (buttons, forms, tables, menus, messages, loaders, etc.). Do not write plain HTML `<button>`, `<input>`, `<table>` elements in components — use the SUI equivalents.
- Exception: the SVG countdown ring in `Header.jsx` has no SUI equivalent and stays as a custom `<svg>`.
- Use `<Link>` from `react-router-dom` for navigation between pages. Do not use `<a href>` for internal routes.
- Pass router `<Link>` elements as props to components that need navigation (e.g., `resetPasswordLink` prop on `LoginForm`) rather than importing the router inside shared components.

### Formatting
Always use `fmtInt` and `fmtFloat` from `utils/format.js` when rendering numeric option chain values. Never format numbers inline in components.

### Styling
- Semantic UI CSS (imported in `main.jsx`) provides the base reset and typography.
- `style.css` contains only global CSS variables and body defaults.
- `App.css` contains only styles SUI cannot express: ATM row tint, OI change colours, strike/IV/volume cell styles, countdown SVG, and the login page full-viewport wrapper.
- There are no per-component CSS files.
- Color convention for OI changes: positive → `.oi-positive` (green), negative → `.oi-negative` (red).

### Server
`server.js` is intentionally a single file. Keep all server logic there unless it grows significantly. New API routes follow the existing pattern: call `refreshSession()` first, then hit the NSE API with `DEFAULT_HEADERS`.

### Adding new pages
Place new page components in `client/src/pages/`. Register the route in `App.jsx`. Wrap with `RequireAuth` if the page requires authentication, or `RedirectIfAuthenticated` if it should be inaccessible once logged in.

### Adding new components
Place new React components in `client/src/components/`. Keep them functional and prop-driven. Do not fetch data or read auth state inside components — receive everything via props.
