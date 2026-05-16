import {
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper,
} from '@mui/material';

// ── palette ───────────────────────────────────────────────────────────────────
const CALL_BG       = 'rgba(254,226,226,0.5)';
const PUT_BG        = 'rgba(220,252,231,0.5)';
const ATM_BG        = 'rgba(251,191,36,0.18)';
const ATM_BORDER    = 'rgba(251,191,36,0.7)';
const STRIKE_BG     = '#1e293b';
const HOVER_CALL_BG = 'rgba(254,202,202,0.65)';
const HOVER_PUT_BG  = 'rgba(187,247,208,0.65)';
const HOVER_ATM_BG  = 'rgba(251,191,36,0.28)';

// ── OI change style — isMax = highest absolute ΔOI in the visible window ──────
function oiSx(value, isMax = false) {
  const fontSize = isMax ? '1.1rem' : '0.95rem';
  if (!value) return { fontVariantNumeric: 'tabular-nums', fontSize };
  return value > 0
    ? { color: '#15803d', fontWeight: isMax ? 800 : 700, fontSize, fontVariantNumeric: 'tabular-nums' }
    : { color: '#dc2626', fontWeight: 800, fontSize, fontVariantNumeric: 'tabular-nums' };
}

// ── base cell ─────────────────────────────────────────────────────────────────
const base = {
  textAlign: 'center',
  py: '6px', px: '8px',
  fontSize: '0.88rem',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  width: 72,
};

function Row({ item, fmtInt, fmtFloat, isATM, maxCEVol, maxPEVol, maxCEOI, maxPEOI }) {
  const ce = item.CE || {};
  const pe = item.PE || {};

  const isMaxCallOI = maxCEOI > 0 && Math.abs(ce.changeinOpenInterest || 0) === maxCEOI;
  const isMaxPutOI  = maxPEOI > 0 && Math.abs(pe.changeinOpenInterest || 0) === maxPEOI;

  const callCell = (extra = {}) => ({ ...base, background: isATM ? ATM_BG : CALL_BG, ...extra });
  const putCell  = (extra = {}) => ({ ...base, background: isATM ? ATM_BG : PUT_BG,  ...extra });

  return (
    <TableRow
      sx={{
        ...(isATM && { outline: `1.5px solid ${ATM_BORDER}`, outlineOffset: '-1px' }),
        '&:hover .call-cell': { background: `${isATM ? HOVER_ATM_BG : HOVER_CALL_BG} !important` },
        '&:hover .put-cell':  { background: `${isATM ? HOVER_ATM_BG : HOVER_PUT_BG}  !important` },
        '&:hover': { boxShadow: 'inset 3px 0 0 #3b82f6' },
      }}
    >
      {/* CALLS */}
      <TableCell className="call-cell" sx={callCell({ color: '#94a3b8', fontSize: '0.8rem' })}>
        {fmtFloat(ce.impliedVolatility)}
      </TableCell>
      <TableCell className="call-cell" sx={callCell()}>
        {fmtFloat(ce.lastPrice)}
      </TableCell>
      <TableCell className="call-cell" sx={callCell(
        ce.totalTradedVolume === maxCEVol
          ? { color: '#dc2626', fontWeight: 800, background: isATM ? ATM_BG : 'rgba(220,38,38,0.12) !important' }
          : { color: '#7c3aed', fontWeight: 600 }
      )}>
        {Math.trunc((ce.totalTradedVolume || 0) / 1000)}
      </TableCell>
      <TableCell className="call-cell" sx={callCell()}>
        {fmtInt(ce.openInterest)}
      </TableCell>
      <TableCell className="call-cell" sx={callCell(oiSx(ce.changeinOpenInterest, isMaxCallOI))}>
        {fmtInt(ce.changeinOpenInterest)}
      </TableCell>

      {/* STRIKE */}
      <TableCell
        className="strike-cell"
        sx={{
          ...base,
          width: 88,
          background: `${STRIKE_BG} !important`,
          color: isATM
            ? '#fbbf24'
            : isMaxCallOI && isMaxPutOI ? '#f0abfc'
            : isMaxCallOI               ? '#fca5a5'
            : isMaxPutOI                ? '#86efac'
            : '#e2e8f0',
          fontWeight: 800,
          fontSize: '1.1rem',
          letterSpacing: '0.02em',
          borderLeft:  isMaxCallOI ? '3px solid #dc2626' : '3px solid transparent',
          borderRight: isMaxPutOI  ? '3px solid #16a34a' : '3px solid transparent',
          ...(isMaxCallOI && !isMaxPutOI && { background: '#2d1515 !important' }),
          ...(isMaxPutOI  && !isMaxCallOI && { background: '#0f2d1a !important' }),
          ...(isMaxCallOI && isMaxPutOI   && { background: '#1e1a2d !important' }),
          '&:hover': { background: 'inherit' },
        }}
      >
        {fmtInt(item.strikePrice)}
      </TableCell>

      {/* PUTS */}
      <TableCell className="put-cell" sx={putCell(oiSx(pe.changeinOpenInterest, isMaxPutOI))}>
        {fmtInt(pe.changeinOpenInterest)}
      </TableCell>
      <TableCell className="put-cell" sx={putCell()}>
        {fmtInt(pe.openInterest)}
      </TableCell>
      <TableCell className="put-cell" sx={putCell(
        pe.totalTradedVolume === maxPEVol
          ? { color: '#dc2626', fontWeight: 800, background: isATM ? ATM_BG : 'rgba(220,38,38,0.12) !important' }
          : { color: '#7c3aed', fontWeight: 600 }
      )}>
        {Math.trunc((pe.totalTradedVolume || 0) / 1000)}
      </TableCell>
      <TableCell className="put-cell" sx={putCell()}>
        {fmtFloat(pe.lastPrice)}
      </TableCell>
      <TableCell className="put-cell" sx={putCell({ color: '#94a3b8', fontSize: '0.8rem' })}>
        {fmtFloat(pe.impliedVolatility)}
      </TableCell>
    </TableRow>
  );
}

const bandSx = (gradient, border) => ({
  textAlign: 'center', fontWeight: 800, fontSize: '0.8rem',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  background: gradient, color: '#fff',
  borderBottom: `2px solid ${border}`, py: '8px',
});

const subSx = {
  textAlign: 'center', py: '5px', px: '8px',
  background: '#f1f5f9', color: '#64748b',
  fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.07em', textTransform: 'uppercase',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

export default function OptionTable({ items, atmStrike, fmtInt, fmtFloat }) {
  const maxCEVol = Math.max(...items.map(it => it.CE?.totalTradedVolume || 0));
  const maxPEVol = Math.max(...items.map(it => it.PE?.totalTradedVolume || 0));
  const maxCEOI  = Math.max(...items.map(it => Math.abs(it.CE?.changeinOpenInterest || 0)));
  const maxPEOI  = Math.max(...items.map(it => Math.abs(it.PE?.changeinOpenInterest || 0)));

  return (
    <TableContainer component={Paper} elevation={3} sx={{ mb: 1.5, borderRadius: 2, overflowX: 'auto', border: '1px solid #e2e8f0' }}>
      <Table size="small" sx={{ minWidth: 700, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell colSpan={5} sx={bandSx('linear-gradient(135deg,#991b1b,#dc2626)', '#b91c1c')}>CALLS</TableCell>
            <TableCell sx={{ ...bandSx('none', 'transparent'), background: STRIKE_BG, color: '#64748b', fontSize: '0.7rem' }}>STRIKE</TableCell>
            <TableCell colSpan={5} sx={bandSx('linear-gradient(135deg,#14532d,#16a34a)', '#15803d')}>PUTS</TableCell>
          </TableRow>
          <TableRow>
            {['IV','LTP','Vol','OI','ΔOI'].map(h => <TableCell key={`c-${h}`} sx={subSx}>{h}</TableCell>)}
            <TableCell sx={{ ...subSx, background: STRIKE_BG, color: '#475569', borderBottom: '2px solid #334155' }} />
            {['ΔOI','OI','Vol','LTP','IV'].map(h => <TableCell key={`p-${h}`} sx={subSx}>{h}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map(it => (
            <Row
              key={it.strikePrice}
              item={it}
              fmtInt={fmtInt}
              fmtFloat={fmtFloat}
              isATM={Number(it.strikePrice) === atmStrike}
              maxCEVol={maxCEVol}
              maxPEVol={maxPEVol}
              maxCEOI={maxCEOI}
              maxPEOI={maxPEOI}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
