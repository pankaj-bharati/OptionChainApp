import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, CircularProgress, Typography, Paper, IconButton, Tooltip, Chip } from '@mui/material';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import HistoryIcon      from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon       from '@mui/icons-material/Restore';

import { useAuth }    from '../context/AuthContext';
import AppHeader      from '../components/layout/AppHeader';
import Summary        from '../components/dashboard/Summary';
import BiasBanner     from '../components/dashboard/BiasBanner';
import OptionTable    from '../components/dashboard/OptionTable';
import OIChart        from '../components/dashboard/OIChart';
import OIHistory      from '../components/dashboard/OIHistory';
import { fmtInt, fmtFloat } from '../utils/format';

const FETCH_INTERVAL    = 30000;       // 30 s
const OI_HISTORY_MAX    = 100;         // max snapshots kept in state + localStorage
const HISTORY_BACKUP_KEY = 'oiHistoryBackup';   // localStorage key for deleted backup
const RESTORE_WINDOW_MS  = 24 * 60 * 60 * 1000; // 24 hours

/** Save a backup of history with a deletion timestamp */
function saveBackup(history) {
  try {
    localStorage.setItem(HISTORY_BACKUP_KEY, JSON.stringify({ data: history, deletedAt: Date.now() }));
  } catch (_) {}
}

/** Load backup if it exists and is within the restore window */
function loadBackup() {
  try {
    const raw = localStorage.getItem(HISTORY_BACKUP_KEY);
    if (!raw) return null;
    const { data, deletedAt } = JSON.parse(raw);
    if (Date.now() - deletedAt > RESTORE_WINDOW_MS) {
      localStorage.removeItem(HISTORY_BACKUP_KEY);
      return null;
    }
    return { data, deletedAt };
  } catch (_) { return null; }
}

function getWindowedItems(items, underlying, n = 5) {
  if (!Array.isArray(items) || items.length === 0) return { items: [], atmStrike: null };
  if (!underlying) return { items, atmStrike: null };
  const u = Number(underlying);
  if (!Number.isFinite(u)) return { items, atmStrike: null };
  const nearest50 = Math.round(u / 50) * 50;
  let idx = items.findIndex(it => Number(it?.strikePrice) === nearest50);
  if (idx === -1) {
    let minDiff = Infinity;
    items.forEach((it, i) => {
      const d = Math.abs(Number(it?.strikePrice) - u);
      if (Number.isFinite(d) && d < minDiff) { minDiff = d; idx = i; }
    });
  }
  if (idx === -1) return { items, atmStrike: null };
  return {
    items: items.slice(Math.max(0, idx - n), Math.min(items.length, idx + n + 1)),
    atmStrike: Number(items[idx]?.strikePrice),
  };
}

function PanelHeader({ icon: Icon, title, subtitle, iconColor }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Icon sx={{ color: iconColor, fontSize: '1.3rem' }} />
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
      </Box>
    </Box>
  );
}

export default function HomePage() {
  const { handleLogout } = useAuth();

  const [optionChainData, setOptionChainData] = useState(null);
  const [underlyingValue, setUnderlyingValue] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('oiHistory')) || { calls: [], puts: [] }; }
    catch { return { calls: [], puts: [] }; }
  });
  const [itemChainData, setItemChainData] = useState(() => {
    try { return Number(localStorage.getItem('itemChainData')) || 2; }
    catch { return 2; }
  });
  // When ON  → keep OI history when window size changes
  // When OFF → clear OI history on window size change (original behaviour)
  const [keepHistory, setKeepHistory] = useState(() => {
    try { return localStorage.getItem('keepHistoryOnWindowChange') === 'true'; }
    catch { return false; }
  });
  const [expiryDates, setExpiryDates]       = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [lastFetch, setLastFetch]           = useState(null);
  const [now, setNow]                       = useState(Date.now());
  // Backup for restore — loaded once on mount
  const [backup, setBackup] = useState(() => loadBackup());

  // Fetch expiry dates once
  useEffect(() => {
    axios.get('http://localhost:3000/api/expiry-dates', { withCredentials: true })
      .then(res => {
        setExpiryDates(res.data.expiryDates);
        if (res.data.expiryDates.length > 0) setSelectedExpiry(res.data.expiryDates[0]);
      })
      .catch(err => console.error('Error fetching expiry dates:', err));
  }, []);

  // Fetch option chain on expiry change, poll every 30 s
  useEffect(() => {
    if (!selectedExpiry) return;
    const fetchData = async () => {
      try {
        const res  = await axios.get(`http://localhost:3000/api/option-chain?expiry=${selectedExpiry}`, { withCredentials: true });
        const data = res.data;
        setOptionChainData(data.filtered?.data || data.records?.data || []);
        setUnderlyingValue(data.filtered?.underlyingValue || data.records?.underlyingValue || null);
        setLastFetch(Date.now());
      } catch (err) { console.error('Error fetching option chain:', err); }
    };
    fetchData();
    const interval = setInterval(fetchData, FETCH_INTERVAL);
    const tick     = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [selectedExpiry]);

  // Accumulate OI history in localStorage
  useEffect(() => {
    if (!optionChainData || !underlyingValue) return;
    const { items: windowed } = getWindowedItems(optionChainData, underlyingValue, itemChainData);
    const agg = windowed.reduce(
      (acc, it) => ({ calls: acc.calls + (it.CE?.changeinOpenInterest || 0), puts: acc.puts + (it.PE?.changeinOpenInterest || 0) }),
      { calls: 0, puts: 0 }
    );
    if (!agg.calls && !agg.puts) return;
    const timestamp = new Date().toLocaleTimeString();
    setHistory(prev => {
      const sameCalls = prev.calls[0]?.value === agg.calls;
      const samePuts  = prev.puts[0]?.value  === agg.puts;
      if (sameCalls && samePuts) return prev;
      const next = {
        calls: sameCalls ? prev.calls : [{ value: agg.calls, time: timestamp }, ...prev.calls].slice(0, OI_HISTORY_MAX),
        puts:  samePuts  ? prev.puts  : [{ value: agg.puts,  time: timestamp }, ...prev.puts ].slice(0, OI_HISTORY_MAX),
      };
      localStorage.setItem('oiHistory', JSON.stringify(next));
      return next;
    });
  }, [optionChainData, underlyingValue, itemChainData]);

  if (!optionChainData) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography color="text.secondary">Loading option chain…</Typography>
      </Box>
    );
  }

  // Countdown
  const msSinceLast      = lastFetch ? Math.max(0, now - lastFetch) : FETCH_INTERVAL;
  const msRemaining      = Math.max(0, FETCH_INTERVAL - msSinceLast);
  const secondsRemaining = Math.ceil(msRemaining / 1000);
  const progress         = 1 - msRemaining / FETCH_INTERVAL;

  const { items: displayedItems, atmStrike } = getWindowedItems(optionChainData, underlyingValue, itemChainData);
  const aggregateOIChange = displayedItems.reduce(
    (acc, it) => ({ calls: acc.calls + (it.CE?.changeinOpenInterest || 0), puts: acc.puts + (it.PE?.changeinOpenInterest || 0) }),
    { calls: 0, puts: 0 }
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader
        underlyingValue={underlyingValue}
        itemChainData={itemChainData}
        setItemChainData={v => {
          setItemChainData(v);
          if (!keepHistory) {
            setHistory({ calls: [], puts: [] });
            localStorage.removeItem('oiHistory');
          }
          try { localStorage.setItem('itemChainData', String(v)); } catch {}
        }}
        keepHistory={keepHistory}
        setKeepHistory={v => {
          setKeepHistory(v);
          try { localStorage.setItem('keepHistoryOnWindowChange', String(v)); } catch {}
        }}
        expiryDates={expiryDates}
        selectedExpiry={selectedExpiry}
        setSelectedExpiry={setSelectedExpiry}
        secondsRemaining={secondsRemaining}
        progress={progress}
        onLogout={handleLogout}
      />

      <Box sx={{ px: { xs: 1, sm: 2 }, pb: 4 }}>
        {/* Live bias banner */}
        <Box sx={{ mt: 1.5 }}>
          <BiasBanner aggregate={aggregateOIChange} />
        </Box>

        {/* Summary cards */}
        <Summary aggregate={aggregateOIChange} fmtInt={fmtInt} />

        {/* Option chain table */}
        <OptionTable items={displayedItems} atmStrike={atmStrike} fmtInt={fmtInt} fmtFloat={fmtFloat} />

        {/* Two-panel analysis */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 1 }}>

          {/* Live panel */}
          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            <PanelHeader
              icon={SatelliteAltIcon} iconColor="#3b82f6"
              title="Live — Current Window ΔOI"
              subtitle={`±${itemChainData} strikes · updates every 30 s`}
            />
            <BiasBanner aggregate={aggregateOIChange} />
            <OIChart aggregate={aggregateOIChange} fmtInt={fmtInt} />
          </Paper>

          {/* History panel */}
          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            {/* ── History panel header with delete / restore ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <HistoryIcon sx={{ color: '#8b5cf6', fontSize: '1.3rem' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  History — Cumulative ΔOI Snapshots
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Last {Math.max(history.calls.length, history.puts.length)} snapshots
                </Typography>
              </Box>

              {/* Restore button — only when a valid backup exists */}
              {backup && (
                <Tooltip title={`Restore deleted history (expires in ${Math.max(0, Math.round((RESTORE_WINDOW_MS - (Date.now() - backup.deletedAt)) / 3600000))}h)`}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setHistory(backup.data);
                      localStorage.setItem('oiHistory', JSON.stringify(backup.data));
                      localStorage.removeItem(HISTORY_BACKUP_KEY);
                      setBackup(null);
                    }}
                    sx={{ color: '#8b5cf6', border: '1px solid #8b5cf6', borderRadius: 1.5, '&:hover': { background: 'rgba(139,92,246,0.08)' } }}
                  >
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Delete button — only when there is history to delete */}
              {(history.calls.length > 0 || history.puts.length > 0) && (
                <Tooltip title="Delete history (restorable within 24 h)">
                  <IconButton
                    size="small"
                    onClick={() => {
                      saveBackup(history);
                      setBackup(loadBackup());
                      setHistory({ calls: [], puts: [] });
                      localStorage.removeItem('oiHistory');
                    }}
                    sx={{ color: '#dc2626', border: '1px solid #dc2626', borderRadius: 1.5, '&:hover': { background: 'rgba(220,38,38,0.08)' } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <BiasBanner history={history} />
            <OIChart history={history} fmtInt={fmtInt} />
            <OIHistory history={history} fmtInt={fmtInt} />
          </Paper>

        </Box>
      </Box>
    </Box>
  );
}
