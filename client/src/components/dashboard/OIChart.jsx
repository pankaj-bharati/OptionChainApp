import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Box, Paper, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Calls heavier → RED  (resistance → market DOWN)
// Puts  heavier → GREEN (support   → market UP)
const BLUE        = '#3b82f6';
const CALL_ACTIVE = '#db2828';
const PUT_ACTIVE  = '#21ba45';
const NEUTRAL_FG  = '#767676';

function totalAbs(arr) {
  return (arr ?? []).reduce((s, x) => s + Math.abs(x.value ?? 0), 0);
}
function absPct(part, total) {
  if (!total) return 0;
  return Math.round((Math.abs(part) / total) * 100);
}
function dominant(cp, pp) {
  return cp > pp + 5 ? 'calls' : pp > cp + 5 ? 'puts' : 'neutral';
}
function cColor(dom) { return dom === 'calls' ? CALL_ACTIVE : BLUE; }
function pColor(dom) { return dom === 'puts'  ? PUT_ACTIVE  : BLUE; }

function BarLabel({ x, y, width, height, value }) {
  if (value == null || value === 0) return null;
  const inside = Math.abs(height) > 28;
  const labelY = value >= 0
    ? (inside ? y + 16 : y - 6)
    : (inside ? y + height - 6 : y + height + 14);
  return (
    <text x={x + width / 2} y={labelY} textAnchor="middle" fontSize={11} fontWeight={700} fill={inside ? '#fff' : '#444'}>
      {value > 0 ? '+' : ''}{value.toLocaleString('en-IN')}
    </text>
  );
}

const captionSx = {
  display: 'block', textAlign: 'center', mb: 0.5,
  color: NEUTRAL_FG, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

function StackedBar({ cp, pp, cc, pc, fmtInt, callVal, putVal, cumulative }) {
  return (
    <Box sx={{ mx: 0.5, mt: 1.5, mb: 0.5 }}>
      <Box sx={{ display: 'flex', height: 36, borderRadius: 1, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
        <Box sx={{ width: `${cp}%`, background: cc, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', transition: 'width 0.5s ease, background 0.4s ease' }}>
          {cp > 10 ? (cumulative ? `Calls ${cp}%` : `${cp}%`) : ''}
        </Box>
        <Box sx={{ width: `${pp}%`, background: pc, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem', transition: 'width 0.5s ease, background 0.4s ease' }}>
          {pp > 10 ? (cumulative ? `Puts ${pp}%` : `${pp}%`) : ''}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, fontSize: '0.82rem', color: NEUTRAL_FG }}>
        <span>{cumulative ? 'Total ' : ''}Calls: <strong style={{ color: cc }}>{fmtInt(Math.abs(callVal))}</strong></span>
        <span>{cumulative ? 'Total ' : ''}Puts: <strong style={{ color: pc }}>{fmtInt(Math.abs(putVal))}</strong></span>
      </Box>
    </Box>
  );
}

// ── Live chart ────────────────────────────────────────────────────────────────
function LiveChart({ aggregate, fmtInt }) {
  const callVal = aggregate?.calls ?? 0;
  const putVal  = aggregate?.puts  ?? 0;
  const grand   = Math.abs(callVal) + Math.abs(putVal);
  const cp = absPct(callVal, grand);
  const pp = absPct(putVal,  grand);
  const dom = dominant(cp, pp);
  const cc  = cColor(dom);
  const pc  = pColor(dom);

  const barData  = [{ name: 'CALL ΔOI', value: callVal }, { name: 'PUT ΔOI', value: putVal }];
  const propData = [{ name: 'Calls', pct: cp }, { name: 'Puts', pct: pp }];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      <Box>
        <Typography variant="caption" sx={captionSx}>Current Window ΔOI</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontWeight: 700, fontSize: 12 }} />
            <YAxis tickFormatter={v => v.toLocaleString('en-IN')} width={80} />
            <Tooltip formatter={v => [v.toLocaleString('en-IN'), 'ΔOI']} />
            <ReferenceLine y={0} stroke="#999" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} label={<BarLabel />}>
              <Cell fill={cc} /><Cell fill={pc} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box>
        <Typography variant="caption" sx={captionSx}>Weightage Split</Typography>
        <StackedBar cp={cp} pp={pp} cc={cc} pc={pc} fmtInt={fmtInt} callVal={callVal} putVal={putVal} />
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={propData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" width={42} tick={{ fontWeight: 700, fontSize: 12 }} />
            <Tooltip formatter={v => [`${v}%`, 'Weight']} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              <Cell fill={cc} /><Cell fill={pc} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

// ── History chart ─────────────────────────────────────────────────────────────
function HistoryChart({ history, fmtInt }) {
  const calls = history?.calls ?? [];
  const puts  = history?.puts  ?? [];

  const totalCalls = totalAbs(calls);
  const totalPuts  = totalAbs(puts);
  const grand = totalCalls + totalPuts;
  const cp = absPct(totalCalls, grand);
  const pp = absPct(totalPuts,  grand);
  const dom = dominant(cp, pp);
  const cc  = cColor(dom);
  const pc  = pColor(dom);

  const latestCall = calls[0]?.value ?? 0;
  const latestPut  = puts[0]?.value  ?? 0;
  const snapData   = [{ name: 'CALL ΔOI', value: latestCall }, { name: 'PUT ΔOI', value: latestPut }];
  const propData   = [{ name: 'Calls', pct: cp }, { name: 'Puts', pct: pp }];

  const maxLen    = Math.max(calls.length, puts.length);
  const trendData = Array.from({ length: maxLen }, (_, i) => {
    const ci = calls.length - 1 - i;
    const pi = puts.length  - 1 - i;
    return {
      time:  calls[ci]?.time ?? puts[pi]?.time ?? `T-${maxLen - i}`,
      calls: calls[ci]?.value ?? null,
      puts:  puts[pi]?.value  ?? null,
    };
  });

  if (!grand && calls.length === 0 && puts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: NEUTRAL_FG }}>
        <AccessTimeIcon sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="body2">No history yet — snapshots accumulate every 30 s</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="caption" sx={captionSx}>Latest Snapshot ΔOI</Typography>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={snapData} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontWeight: 700, fontSize: 12 }} />
              <YAxis tickFormatter={v => v.toLocaleString('en-IN')} width={80} />
              <Tooltip formatter={v => [v.toLocaleString('en-IN'), 'ΔOI']} />
              <ReferenceLine y={0} stroke="#999" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} label={<BarLabel />}>
                <Cell fill={cc} /><Cell fill={pc} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Box>
          <Typography variant="caption" sx={captionSx}>Cumulative Weightage</Typography>
          <StackedBar cp={cp} pp={pp} cc={cc} pc={pc} fmtInt={fmtInt} callVal={totalCalls} putVal={totalPuts} cumulative />
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={propData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" width={42} tick={{ fontWeight: 700, fontSize: 12 }} />
              <Tooltip formatter={v => [`${v}%`, 'Weight']} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                <Cell fill={cc} /><Cell fill={pc} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {trendData.length > 1 && (
        <>
          <Typography variant="caption" sx={{ ...captionSx, mt: 1.5 }}>ΔOI Trend Over Time</Typography>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => v.toLocaleString('en-IN')} width={80} />
              <Tooltip formatter={(v, name) => [v?.toLocaleString('en-IN') ?? '—', name === 'calls' ? 'Call ΔOI' : 'Put ΔOI']} />
              <Legend formatter={v => <span style={{ color: v === 'calls' ? cc : pc, fontWeight: 700 }}>{v === 'calls' ? 'Call ΔOI' : 'Put ΔOI'}</span>} />
              <ReferenceLine y={0} stroke="#aaa" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="calls" stroke={cc} strokeWidth={2.5} dot={{ r: 4, fill: cc, stroke: cc }} activeDot={{ r: 6 }} connectNulls />
              <Line type="monotone" dataKey="puts"  stroke={pc} strokeWidth={2.5} dot={{ r: 4, fill: pc, stroke: pc }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </>
  );
}

/**
 * Props (mutually exclusive — pass one):
 *   aggregate — { calls: number, puts: number }                    → live mode
 *   history   — { calls: [{value,time}], puts: [{value,time}] }    → history mode
 */
export default function OIChart({ aggregate, history, fmtInt }) {
  return (
    <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
      {aggregate != null
        ? <LiveChart aggregate={aggregate} fmtInt={fmtInt} />
        : <HistoryChart history={history} fmtInt={fmtInt} />
      }
    </Paper>
  );
}
