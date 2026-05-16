import { Box, Paper, Typography } from '@mui/material';
import ArrowUpwardIcon    from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon  from '@mui/icons-material/ArrowDownward';
import RemoveIcon         from '@mui/icons-material/Remove';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// Calls = RED (heavy calls → resistance → market DOWN)
// Puts  = GREEN (heavy puts → support → market UP)
const BLUE        = '#3b82f6';
const CALL_ACTIVE = '#dc2626';
const PUT_ACTIVE  = '#16a34a';

function totalAbs(arr) {
  return (arr ?? []).reduce((s, x) => s + Math.abs(x.value ?? 0), 0);
}
function pct(part, total) {
  if (!total) return 0;
  return Math.round((Math.abs(part) / total) * 100);
}
function dominantFromHistory(calls, puts) {
  const tc = totalAbs(calls), tp = totalAbs(puts), g = tc + tp;
  if (!g) return { dominant: null, callPct: 0, putPct: 0 };
  const cp = pct(tc, g), pp = pct(tp, g);
  return { dominant: cp > pp + 5 ? 'calls' : pp > cp + 5 ? 'puts' : 'neutral', callPct: cp, putPct: pp };
}
function dominantFromAggregate(agg) {
  const ac = Math.abs(agg?.calls ?? 0), ap = Math.abs(agg?.puts ?? 0), g = ac + ap;
  if (!g) return { dominant: null, callPct: 0, putPct: 0 };
  const cp = pct(ac, g), pp = pct(ap, g);
  return { dominant: cp > pp + 5 ? 'calls' : pp > cp + 5 ? 'puts' : 'neutral', callPct: cp, putPct: pp };
}

/**
 * Props (mutually exclusive — pass one):
 *   aggregate — { calls: number, puts: number }                    → live mode
 *   history   — { calls: [{value,time}], puts: [{value,time}] }    → history mode
 */
export default function BiasBanner({ history, aggregate }) {
  const { dominant, callPct, putPct } = aggregate != null
    ? dominantFromAggregate(aggregate)
    : dominantFromHistory(history?.calls ?? [], history?.puts ?? []);

  const cBarColor = dominant === 'calls' ? CALL_ACTIVE : BLUE;
  const pBarColor = dominant === 'puts'  ? PUT_ACTIVE  : BLUE;

  let label, Icon, bg, fg, border;
  if (!dominant) {
    label = 'Awaiting data…'; Icon = HourglassEmptyIcon;
    bg = '#f8fafc'; fg = '#94a3b8'; border = '#e2e8f0';
  } else if (dominant === 'calls') {
    label = `BEARISH  ·  Calls ${callPct}%  vs  Puts ${putPct}%  →  Market likely DOWN`;
    Icon = ArrowDownwardIcon; bg = '#fff1f2'; fg = CALL_ACTIVE; border = CALL_ACTIVE;
  } else if (dominant === 'puts') {
    label = `BULLISH  ·  Puts ${putPct}%  vs  Calls ${callPct}%  →  Market likely UP`;
    Icon = ArrowUpwardIcon; bg = '#f0fdf4'; fg = PUT_ACTIVE; border = PUT_ACTIVE;
  } else {
    label = `NEUTRAL  ·  Calls ${callPct}%  vs  Puts ${putPct}%  →  No clear bias`;
    Icon = RemoveIcon; bg = '#f8fafc'; fg = '#475569'; border = '#cbd5e1';
  }

  return (
    <Paper elevation={0} sx={{ mb: 1.5, border: `2px solid ${border}`, borderRadius: 2, overflow: 'hidden', background: bg }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, px: 2, py: 0.9 }}>
        <Icon sx={{ color: fg, fontSize: '1.2rem' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: fg, letterSpacing: '0.02em' }}>
          {label}
        </Typography>
      </Box>
      {dominant && (
        <Box sx={{ display: 'flex', height: 6 }}>
          <Box sx={{ width: `${callPct}%`, background: cBarColor, transition: 'width 0.5s ease, background 0.4s ease' }} />
          <Box sx={{ width: `${putPct}%`,  background: pBarColor, transition: 'width 0.5s ease, background 0.4s ease' }} />
        </Box>
      )}
    </Paper>
  );
}
