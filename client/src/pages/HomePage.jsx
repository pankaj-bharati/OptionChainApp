import { useEffect, useState } from 'react';
import axios from 'axios';
import { Container, Loader } from 'semantic-ui-react';
import { useAuth } from '../AuthContext';

import Header from '../components/Header';
import Summary from '../components/Summary';
import OptionTable from '../components/OptionTable';
import OIHistory from '../components/OIHistory';
import { fmtInt, fmtFloat } from '../utils/format';

const FETCH_INTERVAL = 30000; // 30 s

// nearest multiple of 50 to the underlying value
function getWindowedItems(items, underlying, n = 5) {
  if (!Array.isArray(items) || items.length === 0) return { items: [], atmStrike: null };
  if (!underlying) return { items, atmStrike: null };

  const u = Number(underlying);
  if (!Number.isFinite(u)) return { items, atmStrike: null };

  const nearest50 = Math.round(u / 50) * 50;
  let chosenIndex = items.findIndex(it => Number(it?.strikePrice) === nearest50);

  if (chosenIndex === -1) {
    let minDiff = Infinity;
    items.forEach((it, i) => {
      const d = Math.abs(Number(it?.strikePrice) - u);
      if (Number.isFinite(d) && d < minDiff) { minDiff = d; chosenIndex = i; }
    });
  }

  if (chosenIndex === -1) return { items, atmStrike: null };

  const start = Math.max(0, chosenIndex - n);
  const end   = Math.min(items.length, chosenIndex + n + 1);
  return { items: items.slice(start, end), atmStrike: Number(items[chosenIndex]?.strikePrice) };
}

export default function HomePage() {
  const { handleLogout } = useAuth();

  // ── option chain state ────────────────────────────────────────────────────
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
  const [expiryDates, setExpiryDates]     = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [lastFetch, setLastFetch]         = useState(null);
  const [now, setNow]                     = useState(Date.now());

  // ── fetch expiry dates once ───────────────────────────────────────────────
  useEffect(() => {
    axios.get('http://localhost:3000/api/expiry-dates', { withCredentials: true })
      .then(res => {
        setExpiryDates(res.data.expiryDates);
        if (res.data.expiryDates.length > 0) setSelectedExpiry(res.data.expiryDates[0]);
      })
      .catch(err => console.error('Error fetching expiry dates:', err));
  }, []);

  // ── fetch option chain on expiry change ──────────────────────────────────
  useEffect(() => {
    if (!selectedExpiry) return;

    const fetchData = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/option-chain?expiry=${selectedExpiry}`,
          { withCredentials: true }
        );
        const data = res.data;
        const items = data.filtered?.data || data.records?.data || [];
        setOptionChainData(items);
        setUnderlyingValue(data.filtered?.underlyingValue || data.records?.underlyingValue || null);
        setLastFetch(Date.now());
      } catch (err) {
        console.error('Error fetching option chain:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, FETCH_INTERVAL);
    const tick     = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [selectedExpiry]);

  // ── OI history ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!optionChainData || !underlyingValue) return;

    const { items: windowed } = getWindowedItems(optionChainData, underlyingValue, itemChainData);
    const agg = windowed.reduce(
      (acc, it) => ({
        calls: acc.calls + (it.CE?.changeinOpenInterest || 0),
        puts:  acc.puts  + (it.PE?.changeinOpenInterest || 0),
      }),
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

  // ── loading state ─────────────────────────────────────────────────────────
  if (!optionChainData) {
    return (
      <Loader active size="large" style={{ marginTop: '4rem' }}>
        Loading option chain…
      </Loader>
    );
  }

  // ── countdown ─────────────────────────────────────────────────────────────
  const msSinceLast   = lastFetch ? Math.max(0, now - lastFetch) : FETCH_INTERVAL;
  const msRemaining   = Math.max(0, FETCH_INTERVAL - msSinceLast);
  const secondsRemaining = Math.ceil(msRemaining / 1000);
  const progress      = 1 - msRemaining / FETCH_INTERVAL;

  const { items: displayedItems, atmStrike } = getWindowedItems(optionChainData, underlyingValue, itemChainData);

  const aggregateOIChange = displayedItems.reduce(
    (acc, it) => ({
      calls: acc.calls + (it.CE?.changeinOpenInterest || 0),
      puts:  acc.puts  + (it.PE?.changeinOpenInterest || 0),
    }),
    { calls: 0, puts: 0 }
  );

  return (
    <Container fluid style={{ padding: '0 1rem 2rem' }}>
      <Header
        underlyingValue={underlyingValue}
        itemChainData={itemChainData}
        setItemChainData={(v) => {
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

      <Summary aggregate={aggregateOIChange} fmtInt={fmtInt} />

      <OptionTable
        items={displayedItems}
        atmStrike={atmStrike}
        fmtInt={fmtInt}
        fmtFloat={fmtFloat}
      />

      <OIHistory history={history} fmtInt={fmtInt} />
    </Container>
  );
}
