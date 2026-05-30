import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Box, CircularProgress, Typography, Paper,
  AppBar, Toolbar, FormControl, InputLabel, Select, MenuItem,
  Chip, IconButton, Tooltip, TextField, InputAdornment,
} from '@mui/material';
import {
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SearchIcon    from '@mui/icons-material/Search';
import { fmtInt, fmtFloat } from '../utils/format';

// ── palette ───────────────────────────────────────────────────────────────────
const CALL_BG       = 'rgba(254,226,226,0.5)';
const PUT_BG        = 'rgba(220,252,231,0.5)';
const ATM_BG        = 'rgba(251,191,36,0.18)';
const ATM_BORDER    = 'rgba(251,191,36,0.7)';
const STRIKE_BG     = '#1e293b';
const HOVER_CALL_BG = 'rgba(254,202,202,0.7)';
const HOVER_PUT_BG  = 'rgba(187,247,208,0.7)';
const HOVER_ATM_BG  = 'rgba(251,191,36,0.28)';

// ── All CE/PE fields from NSE option-chain-v3 API ────────────────────────────
// Each entry: { key, label, render, align? }
const CE_COLS = [
  { key: 'impliedVolatility',      label: 'IV',        render: v => fmtFloat(v),                          muted: true  },
  { key: 'lastPrice',              label: 'LTP',       render: v => fmtFloat(v)                                        },
  { key: 'change',                 label: 'Chg',       render: v => fmtFloat(v),                          muted: true  },
  { key: 'pChange',                label: 'Chg%',      render: v => v != null ? `${fmtFloat(v)}%` : '-',  muted: true  },
  { key: 'bidQty',                 label: 'Bid Qty',   render: v => fmtInt(v),                            muted: true  },
  { key: 'bidprice',               label: 'Bid',       render: v => fmtFloat(v),                          muted: true  },
  { key: 'askPrice',               label: 'Ask',       render: v => fmtFloat(v),                          muted: true  },
  { key: 'askQty',                 label: 'Ask Qty',   render: v => fmtInt(v),                            muted: true  },
  { key: 'totalBuyQuantity',       label: 'Buy Qty',   render: v => fmtInt(v)                                          },
  { key: 'totalSellQuantity',      label: 'Sell Qty',  render: v => fmtInt(v)                                          },
  { key: 'totalTradedVolume',      label: 'Vol(K)',    render: v => fmtInt(Math.trunc((v || 0) / 1000)),  isVol: true  },
  { key: 'openInterest',           label: 'OI',        render: v => fmtInt(v)                                          },
  { key: 'changeinOpenInterest',   label: 'ΔOI',       render: v => fmtInt(v),                            isOI: true   },
  { key: 'pchangeinOpenInterest',  label: 'ΔOI%',      render: v => v != null ? `${fmtFloat(v)}%` : '-',  muted: true  },
];

// PUT columns mirror CALL columns (reversed for symmetry around strike)
const PE_COLS = [...CE_COLS].reverse();

// ── style helpers ─────────────────────────────────────────────────────────────
const base = {
  textAlign: 'center',
  py: '5px', px: '5px',
  fontSize: '0.8rem',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

function oiSx(value, isMax) {
  const fontSize = isMax ? '0.95rem' : '0.8rem';
  if (!value) return { fontVariantNumeric: 'tabular-nums', fontSize };
  return value > 0
    ? { color: '#15803d', fontWeight: isMax ? 800 : 700, fontSize, fontVariantNumeric: 'tabular-nums' }
    : { color: '#dc2626', fontWeight: 800, fontSize, fontVariantNumeric: 'tabular-nums' };
}

function pctSx(value) {
  if (!value) return { color: '#94a3b8', fontSize: '0.78rem' };
  return value > 0
    ? { color: '#15803d', fontSize: '0.78rem' }
    : { color: '#dc2626', fontSize: '0.78rem' };
}

const bandSx = (gradient, border) => ({
  textAlign: 'center', fontWeight: 800, fontSize: '0.75rem',
  letterSpacing: '0.1em', textTransform: 'uppercase',
  background: gradient, color: '#fff',
  borderBottom: `2px solid ${border}`, py: '6px',
  position: 'sticky', top: 0, zIndex: 3,
});

const subSx = (bg = '#f1f5f9') => ({
  textAlign: 'center', py: '4px', px: '5px',
  background: bg, color: bg === '#f1f5f9' ? '#64748b' : '#475569',
  fontSize: '0.65rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
  position: 'sticky', top: 28, zIndex: 3,
});

// ── ATM helper ────────────────────────────────────────────────────────────────
function getAtmStrike(items, underlying) {
  if (!underlying || !items.length) return null;
  const u = Number(underlying);
  if (!Number.isFinite(u)) return null;
  const nearest50 = Math.round(u / 50) * 50;
  if (items.some(it => Number(it.strikePrice) === nearest50)) return nearest50;
  let best = null, minDiff = Infinity;
  items.forEach(it => {
    const d = Math.abs(Number(it.strikePrice) - u);
    if (d < minDiff) { minDiff = d; best = Number(it.strikePrice); }
  });
  return best;
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ item, atmStrike, maxCEVol, maxPEVol, maxCEOI, maxPEOI }) {
  const ce = item.CE || {};
  const pe = item.PE || {};
  const isATM       = Number(item.strikePrice) === atmStrike;
  const isMaxCallOI = maxCEOI > 0 && Math.abs(ce.changeinOpenInterest || 0) === maxCEOI;
  const isMaxPutOI  = maxPEOI > 0 && Math.abs(pe.changeinOpenInterest || 0) === maxPEOI;

  const callBg = isATM ? ATM_BG : CALL_BG;
  const putBg  = isATM ? ATM_BG : PUT_BG;

  function cellSx(side, col, data) {
    const bg = side === 'call' ? callBg : putBg;
    let extra = {};

    if (col.isOI) {
      const isMax = side === 'call' ? isMaxCallOI : isMaxPutOI;
      extra = oiSx(data[col.key], isMax);
    } else if (col.key === 'pchangeinOpenInterest' || col.key === 'pChange') {
      extra = pctSx(data[col.key]);
    } else if (col.isVol) {
      const isMaxVol = side === 'call'
        ? data.totalTradedVolume === maxCEVol
        : data.totalTradedVolume === maxPEVol;
      extra = isMaxVol
        ? { color: '#dc2626', fontWeight: 800, background: isATM ? ATM_BG : 'rgba(220,38,38,0.12) !important' }
        : { color: '#7c3aed', fontWeight: 600 };
    } else if (col.muted) {
      extra = { color: '#94a3b8', fontSize: '0.75rem' };
    }

    return { ...base, background: bg, ...extra };
  }

  return (
    <TableRow
      sx={{
        ...(isATM && { outline: `1.5px solid ${ATM_BORDER}`, outlineOffset: '-1px' }),
        '&:hover .call-cell': { background: `${isATM ? HOVER_ATM_BG : HOVER_CALL_BG} !important` },
        '&:hover .put-cell':  { background: `${isATM ? HOVER_ATM_BG : HOVER_PUT_BG}  !important` },
        '&:hover': { boxShadow: 'inset 3px 0 0 #3b82f6' },
      }}
    >
      {/* CALL cells */}
      {CE_COLS.map(col => (
        <TableCell key={`ce-${col.key}`} className="call-cell" sx={cellSx('call', col, ce)}>
          {col.render(ce[col.key])}
        </TableCell>
      ))}

      {/* STRIKE — sticky centre column */}
      <TableCell
        className="strike-cell"
        sx={{
          ...base,
          px: '8px',
          minWidth: 80,
          position: 'sticky',
          left: '50%',
          background: `${STRIKE_BG} !important`,
          color: isATM
            ? '#fbbf24'
            : isMaxCallOI && isMaxPutOI ? '#f0abfc'
            : isMaxCallOI               ? '#fca5a5'
            : isMaxPutOI                ? '#86efac'
            : '#e2e8f0',
          fontWeight: 800,
          fontSize: '1rem',
          letterSpacing: '0.02em',
          borderLeft:  isMaxCallOI ? '3px solid #dc2626' : '3px solid transparent',
          borderRight: isMaxPutOI  ? '3px solid #16a34a' : '3px solid transparent',
          ...(isMaxCallOI && !isMaxPutOI && { background: '#2d1515 !important' }),
          ...(isMaxPutOI  && !isMaxCallOI && { background: '#0f2d1a !important' }),
          ...(isMaxCallOI && isMaxPutOI   && { background: '#1e1a2d !important' }),
          zIndex: 2,
        }}
      >
        {fmtInt(item.strikePrice)}
      </TableCell>

      {/* PUT cells (reversed order) */}
      {PE_COLS.map(col => (
        <TableCell key={`pe-${col.key}`} className="put-cell" sx={cellSx('put', col, pe)}>
          {col.render(pe[col.key])}
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OptionChainPage() {
  const [items, setItems]                   = useState([]);
  const [underlying, setUnderlying]         = useState(null);
  const [expiryDates, setExpiryDates]       = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [strikeFilter, setStrikeFilter]     = useState('');

  useEffect(() => {
    axios.get('http://localhost:3000/api/expiry-dates', { withCredentials: true })
      .then(res => {
        const dates = res.data.expiryDates || [];
        setExpiryDates(dates);
        if (dates.length > 0) setSelectedExpiry(dates[0]);
      })
      .catch(() => setError('Failed to load expiry dates.'));
  }, []);

  useEffect(() => {
    if (!selectedExpiry) return;
    setLoading(true);
    setError('');
    axios.get(`http://localhost:3000/api/option-chain?expiry=${selectedExpiry}`, { withCredentials: true })
      .then(res => {
        const data = res.data;
        setItems(data.filtered?.data || data.records?.data || []);
        setUnderlying(data.filtered?.underlyingValue || data.records?.underlyingValue || null);
      })
      .catch(() => setError('Failed to load option chain data.'))
      .finally(() => setLoading(false));
  }, [selectedExpiry]);

  const atmStrike = useMemo(() => getAtmStrike(items, underlying), [items, underlying]);

  const displayedItems = useMemo(() => {
    if (!strikeFilter.trim()) return items;
    return items.filter(it => String(it.strikePrice).includes(strikeFilter.trim()));
  }, [items, strikeFilter]);

  const maxCEVol = useMemo(() => Math.max(0, ...displayedItems.map(it => it.CE?.totalTradedVolume || 0)), [displayedItems]);
  const maxPEVol = useMemo(() => Math.max(0, ...displayedItems.map(it => it.PE?.totalTradedVolume || 0)), [displayedItems]);
  const maxCEOI  = useMemo(() => Math.max(0, ...displayedItems.map(it => Math.abs(it.CE?.changeinOpenInterest || 0))), [displayedItems]);
  const maxPEOI  = useMemo(() => Math.max(0, ...displayedItems.map(it => Math.abs(it.PE?.changeinOpenInterest || 0))), [displayedItems]);

  const selectSx = {
    color: '#fff',
    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#38bdf8' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#38bdf8' },
    '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>

      {/* ── Sticky header ── */}
      <AppBar position="sticky" elevation={2} sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', minHeight: { xs: 56, sm: 64 } }}>

          <Tooltip title="Back to Dashboard">
            <IconButton component={Link} to="/" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChartIcon sx={{ color: '#38bdf8', fontSize: 26 }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              Full Option Chain
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-focused': { color: '#38bdf8' } }}>Expiry</InputLabel>
            <Select value={selectedExpiry} label="Expiry" onChange={e => setSelectedExpiry(e.target.value)} sx={selectSx}>
              {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>

          {underlying && (
            <Chip
              label={`NIFTY  ${Number(underlying).toLocaleString('en-IN')}`}
              sx={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', fontWeight: 800, fontSize: '0.9rem', px: 0.5 }}
            />
          )}

          <TextField
            size="small"
            placeholder="Filter strike…"
            value={strikeFilter}
            onChange={e => setStrikeFilter(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} /></InputAdornment>,
              sx: { color: '#fff', fontSize: '0.85rem' },
            }}
            sx={{
              ml: 'auto', minWidth: 150,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#38bdf8' },
            }}
          />

          <Chip
            label={`${displayedItems.length} strikes`}
            size="small"
            sx={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}
          />
        </Toolbar>
      </AppBar>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, px: { xs: 0, sm: 1 }, py: { xs: 1, sm: 2 } }}>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', gap: 2 }}>
            <CircularProgress size={40} />
            <Typography color="text.secondary">Loading option chain…</Typography>
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error" variant="h6">{error}</Typography>
          </Box>
        )}

        {!loading && !error && (
          <Paper
            elevation={3}
            sx={{
              borderRadius: { xs: 0, sm: 2 },
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Fluid horizontal scroll container */}
            <TableContainer
              sx={{
                overflowX: 'auto',
                // Custom scrollbar styling
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-track': { background: '#f1f5f9' },
                '&::-webkit-scrollbar-thumb': { background: '#94a3b8', borderRadius: 3 },
              }}
            >
              <Table
                size="small"
                sx={{
                  borderCollapse: 'collapse',
                  tableLayout: 'auto',
                  // Minimum width so all columns are visible; scrolls on small screens
                  minWidth: `${CE_COLS.length * 68 + 80 + PE_COLS.length * 68}px`,
                }}
              >
                <TableHead>
                  {/* Band row */}
                  <TableRow>
                    <TableCell
                      colSpan={CE_COLS.length}
                      sx={bandSx('linear-gradient(135deg,#991b1b,#dc2626)', '#b91c1c')}
                    >
                      CALLS
                    </TableCell>
                    <TableCell
                      sx={{
                        ...bandSx('none', 'transparent'),
                        background: STRIKE_BG,
                        color: '#64748b',
                        fontSize: '0.65rem',
                        px: '8px',
                        position: 'sticky',
                        left: '50%',
                        zIndex: 4,
                      }}
                    >
                      STRIKE
                    </TableCell>
                    <TableCell
                      colSpan={PE_COLS.length}
                      sx={bandSx('linear-gradient(135deg,#14532d,#16a34a)', '#15803d')}
                    >
                      PUTS
                    </TableCell>
                  </TableRow>

                  {/* Sub-header row */}
                  <TableRow>
                    {CE_COLS.map(col => (
                      <TableCell key={`ch-${col.key}`} sx={subSx()}>
                        {col.label}
                      </TableCell>
                    ))}
                    <TableCell
                      sx={{
                        ...subSx(STRIKE_BG),
                        color: '#475569',
                        borderBottom: '2px solid #334155',
                        position: 'sticky',
                        left: '50%',
                        zIndex: 4,
                      }}
                    />
                    {PE_COLS.map(col => (
                      <TableCell key={`ph-${col.key}`} sx={subSx()}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {displayedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={CE_COLS.length + 1 + PE_COLS.length}
                        sx={{ textAlign: 'center', py: 8, color: '#94a3b8', fontSize: '1rem' }}
                      >
                        No strikes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedItems.map(it => (
                      <Row
                        key={it.strikePrice}
                        item={it}
                        atmStrike={atmStrike}
                        maxCEVol={maxCEVol}
                        maxPEVol={maxPEVol}
                        maxCEOI={maxCEOI}
                        maxPEOI={maxPEOI}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Footer summary */}
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 2, flexWrap: 'wrap', bgcolor: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {displayedItems.length} strikes · Expiry: <strong>{selectedExpiry}</strong>
              </Typography>
              {underlying && (
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Underlying: <strong>{Number(underlying).toLocaleString('en-IN')}</strong>
                </Typography>
              )}
              {atmStrike && (
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700 }}>
                  ATM: {fmtInt(atmStrike)}
                </Typography>
              )}
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
