import {
  AppBar, Toolbar, Box, Typography, Select, MenuItem,
  FormControl, InputLabel, Chip, IconButton, Tooltip, Switch, Button,
} from '@mui/material';
import LogoutIcon    from '@mui/icons-material/Logout';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HistoryIcon   from '@mui/icons-material/History';
import TableChartIcon from '@mui/icons-material/TableChart';
import { Link } from 'react-router-dom';

/**
 * Sticky top navigation bar.
 * Contains brand, window selector, expiry selector,
 * NIFTY underlying chip, countdown ring, and logout button.
 */
export default function AppHeader({
  underlyingValue,
  itemChainData,
  setItemChainData,
  keepHistory,
  setKeepHistory,
  expiryDates,
  selectedExpiry,
  setSelectedExpiry,
  secondsRemaining,
  progress,
  onLogout,
}) {
  const windowOptions = Array.from({ length: 9 }, (_, i) => i + 2);

  const selectSx = {
    color: '#fff',
    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#38bdf8' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#38bdf8' },
    '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
  };
  const labelSx = {
    color: 'rgba(255,255,255,0.7)',
    '&.Mui-focused': { color: '#38bdf8' },
  };

  return (
    <AppBar
      position="sticky"
      elevation={2}
      sx={{ mb: 1.5, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}
    >
      <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', minHeight: { xs: 56, sm: 64 } }}>

        {/* Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          <ShowChartIcon sx={{ color: '#38bdf8', fontSize: 28 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Option Chain
          </Typography>
        </Box>

        {/* Full option chain page link */}
        <Tooltip title="Full Option Chain — all strikes">
          <Button
            component={Link}
            to="/option-chain"
            startIcon={<TableChartIcon sx={{ fontSize: 16 }} />}
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2,
              px: 1.5,
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: '#38bdf8' },
            }}
          >
            Full Chain
          </Button>
        </Tooltip>

        {/* Window selector */}
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <InputLabel sx={labelSx}>Window</InputLabel>
          <Select value={itemChainData} label="Window" onChange={e => setItemChainData(Number(e.target.value))} sx={selectSx}>
            {windowOptions.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Keep history toggle */}
        <Tooltip title={keepHistory ? 'History kept when window changes' : 'History cleared when window changes'}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => setKeepHistory(!keepHistory)}>
            <HistoryIcon sx={{ fontSize: 18, color: keepHistory ? '#38bdf8' : 'rgba(255,255,255,0.35)' }} />
            <Switch
              size="small"
              checked={keepHistory}
              onChange={e => setKeepHistory(e.target.checked)}
              onClick={e => e.stopPropagation()}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#38bdf8' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#38bdf8' },
                '& .MuiSwitch-track': { backgroundColor: 'rgba(255,255,255,0.25)' },
              }}
            />
            <Typography variant="caption" sx={{ color: keepHistory ? '#38bdf8' : 'rgba(255,255,255,0.45)', fontWeight: 600, whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
              Keep History
            </Typography>
          </Box>
        </Tooltip>

        {/* Expiry selector */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={labelSx}>Expiry</InputLabel>
          <Select value={selectedExpiry} label="Expiry" onChange={e => setSelectedExpiry(e.target.value)} sx={selectSx}>
            {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Underlying value chip */}
        <Chip
          label={underlyingValue ? `NIFTY  ${Number(underlyingValue).toLocaleString('en-IN')}` : '—'}
          sx={{
            background: 'rgba(56,189,248,0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.4)',
            fontWeight: 800,
            fontSize: '0.95rem',
            letterSpacing: '0.03em',
            px: 0.5,
          }}
        />

        {/* Countdown ring — custom SVG, no MUI equivalent */}
        <Box sx={{ display: 'flex', alignItems: 'center', width: 44, height: 44 }}>
          <svg viewBox="0 0 36 36" className="countdown-ring" style={{ width: 44, height: 44 }}>
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5"
            />
            <path
              stroke="#38bdf8" strokeWidth="2.5" fill="none"
              strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 100} 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <text x="18" y="20.35" className="countdown-text" textAnchor="middle">
              {secondsRemaining}
            </text>
          </svg>
        </Box>

        {/* Logout */}
        <Box sx={{ ml: 'auto' }}>
          {onLogout && (
            <Tooltip title="Logout">
              <IconButton
                onClick={onLogout}
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 2,
                  px: 1.5,
                  gap: 0.5,
                  '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
                }}
              >
                <LogoutIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                  Logout
                </Typography>
              </IconButton>
            </Tooltip>
          )}
        </Box>

      </Toolbar>
    </AppBar>
  );
}
