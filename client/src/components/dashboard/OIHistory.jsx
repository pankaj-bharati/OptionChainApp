import { Box, Paper, Typography, Divider, List, ListItem, ListItemText } from '@mui/material';

export default function OIHistory({ history, fmtInt }) {
  const colorFor = v => v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#64748b';

  const renderList = (items, side) => (
    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', height: '100%' }}>
      <Box sx={{
        px: 2, py: 1,
        background: side === 'calls'
          ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
          : 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
      }}>
        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {side === 'calls' ? 'Call OI History' : 'Put OI History'}
        </Typography>
      </Box>
      <List dense disablePadding>
        {items.length === 0 ? (
          <ListItem>
            <ListItemText primary={<Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center' }}>No data yet</Typography>} />
          </ListItem>
        ) : (
          items.map((item, i) => (
            <Box key={i}>
              <ListItem sx={{ px: 2, py: 0.5 }}>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>{item.time}</Typography>}
                />
                <Typography sx={{ fontWeight: 700, color: colorFor(item.value), fontVariantNumeric: 'tabular-nums' }}>
                  {item.value > 0 ? '+' : ''}{fmtInt(item.value)}
                </Typography>
              </ListItem>
              {i < items.length - 1 && <Divider />}
            </Box>
          ))
        )}
      </List>
    </Paper>
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>
      {renderList(history.calls, 'calls')}
      {renderList(history.puts,  'puts')}
    </Box>
  );
}
