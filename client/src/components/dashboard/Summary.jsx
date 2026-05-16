import { Box, Paper, Typography } from '@mui/material';
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon        from '@mui/icons-material/Remove';

const CALL_RED  = '#dc2626';
const PUT_GREEN = '#16a34a';
const BLUE      = '#3b82f6';

function SummaryCard({ value, label, activeColor }) {
  const color  = value !== 0 ? activeColor : BLUE;
  const Icon   = value > 0 ? ArrowUpwardIcon : value < 0 ? ArrowDownwardIcon : RemoveIcon;
  const bgTint = value !== 0
    ? (activeColor === PUT_GREEN ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.07)')
    : 'rgba(59,130,246,0.07)';

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 2, px: 3,
        background: bgTint,
        border: '1px solid',
        borderColor: `${color}33`,
        borderBottom: `4px solid ${color}`,
        borderRadius: 2,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Icon sx={{ color, fontSize: '1.3rem' }} />
        <Typography sx={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value > 0 ? '+' : ''}{value.toLocaleString('en-IN')}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function Summary({ aggregate }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
      <SummaryCard value={aggregate.calls} label="Call ΔOI" activeColor={CALL_RED}  />
      <SummaryCard value={aggregate.puts}  label="Put ΔOI"  activeColor={PUT_GREEN} />
    </Box>
  );
}
