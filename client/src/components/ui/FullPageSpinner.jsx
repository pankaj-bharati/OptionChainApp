import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Full-viewport centred loading spinner.
 * Used by route guards while auth status is resolving.
 */
export default function FullPageSpinner({ label }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      {label && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  );
}
