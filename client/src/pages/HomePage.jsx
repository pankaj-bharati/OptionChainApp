import { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import HistoryIcon      from '@mui/icons-material/History';

import { useAuth }    from '../context/AuthContext';
import AppHeader      from '../components/layout/AppHeader';
import Summary        from '../components/dashboard/Summary';
import BiasBanner     from '../components/dashboard/BiasBanner';
import OptionTable    from '../components/dashboard/OptionTable';
import OIChart        from '../components/dashboard/OIChart';
import OIHistory      from '../components/dashboard/OIHistory';
import { fmtInt, fmtFloat } from '../utils/format';

const FETCH_INTERVAL = 30000; // 30 s

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
  const [expiryDates, setExpiryDates]       = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [lastFetch, setLastFetch]           = useState(null);
  const [now, setNow]                       = useState(Date.now());

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
        calls: sameCalls ? prev.calls : [{ value: agg.calls, time: timestamp }, ...prev.calls].slice(0, 10),
        puts:  samePuts  ? prev.puts  : [{ value: agg.puts,  time: timestamp }, ...prev.puts ].slice(0, 10),
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
          setHistory({ calls: [], puts: [] });
          localStorage.removeItem('oiHistory');
          try { localStorage.setItem('itemChainData', String(v)); } catch {}
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
            <PanelHeader
              icon={HistoryIcon} iconColor="#8b5cf6"
              title="History — Cumulative ΔOI Snapshots"
              subtitle={`Last ${Math.max(history.calls.length, history.puts.length)} snapshots`}
            />
            <BiasBanner history={history} />
            <OIChart history={history} fmtInt={fmtInt} />
            <OIHistory history={history} fmtInt={fmtInt} />
          </Paper>

        </Box>
      </Box>
    </Box>
  );
}
