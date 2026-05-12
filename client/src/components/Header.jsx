import React from 'react';
import { Menu, Dropdown, Button, Label } from 'semantic-ui-react';

export default function Header({
  underlyingValue,
  itemChainData,
  setItemChainData,
  expiryDates,
  selectedExpiry,
  setSelectedExpiry,
  secondsRemaining,
  progress,
  onLogout,
}) {
  const windowOptions = Array.from({ length: 9 }, (_, i) => ({
    key: i + 2,
    value: i + 2,
    text: String(i + 2),
  }));

  const expiryOptions = expiryDates.map((d) => ({ key: d, value: d, text: d }));

  return (
    <Menu inverted stackable style={{ borderRadius: 0, marginBottom: '1rem' }}>
      {/* Brand */}
      <Menu.Item header>
        <img
          src="./icons/apple-touch-icon.png"
          alt="Nifty"
          style={{ width: 28, height: 28, marginRight: 10 }}
        />
        Option Chain
      </Menu.Item>

      {/* Window selector */}
      <Menu.Item>
        <span style={{ marginRight: 8, fontSize: '0.9em', opacity: 0.85 }}>Window</span>
        <Dropdown
          compact
          selection
          options={windowOptions}
          value={itemChainData}
          onChange={(_, { value }) => setItemChainData(Number(value))}
          style={{ minWidth: 60 }}
        />
      </Menu.Item>

      {/* Expiry selector */}
      <Menu.Item>
        <span style={{ marginRight: 8, fontSize: '0.9em', opacity: 0.85 }}>Expiry</span>
        <Dropdown
          compact
          selection
          options={expiryOptions}
          value={selectedExpiry}
          onChange={(_, { value }) => setSelectedExpiry(value)}
          style={{ minWidth: 120 }}
        />
      </Menu.Item>

      {/* Underlying value */}
      <Menu.Item>
        <Label
          size="large"
          color="blue"
          style={{ fontWeight: 700, letterSpacing: 0.5 }}
        >
          {underlyingValue ?? '—'}
        </Label>
      </Menu.Item>

      {/* Countdown ring — no SUI equivalent, keep custom SVG */}
      <Menu.Item>
        <svg viewBox="0 0 36 36" className="countdown-ring">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
          />
          <path
            stroke="#21ba45"
            strokeWidth="2"
            fill="none"
            strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 100} 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <text x="18" y="20.35" className="countdown-text" textAnchor="middle">
            {secondsRemaining}
          </text>
        </svg>
      </Menu.Item>

      {/* Logout — right-aligned */}
      {onLogout && (
        <Menu.Menu position="right">
          <Menu.Item>
            <Button inverted size="small" onClick={onLogout}>
              Logout
            </Button>
          </Menu.Item>
        </Menu.Menu>
      )}
    </Menu>
  );
}
