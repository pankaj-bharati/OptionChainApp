# Product: NSE Option Chain Viewer

A real-time web application for viewing NIFTY option chain data from the NSE (National Stock Exchange of India). It is designed as a personal/local trading tool that runs entirely on localhost.

## Core Purpose

- Fetch live NIFTY option chain data from NSE's internal API (scraping with cookie-jar session management)
- Display a windowed view of strikes centered around the ATM (At-The-Money) strike
- Track and visualize Change in Open Interest (ΔOI) for calls and puts over time
- Auto-refresh data every 30 seconds with a visual countdown

## Key Concepts

- **ATM Strike**: Nearest multiple of 50 to the current underlying (NIFTY) value
- **Window**: Number of strikes shown above and below ATM (user-configurable, 2–10)
- **ΔOI (Change in Open Interest)**: Primary signal tracked; positive = green, negative = red
- **OI History**: Last 10 unique ΔOI snapshots stored in `localStorage`, reset when window size changes
- **Expiry**: User can select from available weekly/monthly expiry dates; defaults to nearest expiry

## Target User

A single trader running the app locally. The app is password-protected — access requires a login before option chain data is visible. There is no multi-user support or cloud deployment.

## Authentication

The app uses a simple single-password authentication system:

- **Default password**: `admin` (change immediately after first run)
- **Login**: `/login` page — enter password to access the option chain
- **Password reset**: `/reset-password` page — generates a one-time token written to `server/auth.json` on disk; token expires in 15 minutes
- **Session**: HTTP-only cookie, valid for 24 hours; persists across page reloads
- **Logout**: "Logout" button in the header clears the session
