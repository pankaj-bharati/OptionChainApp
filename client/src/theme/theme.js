import { createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#1565c0' },
    secondary:  { main: '#6d28d9' },
    error:      { main: '#dc2626' },
    success:    { main: '#16a34a' },
    background: { default: '#f1f5f9', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar:    { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton:    { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiChip:      { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { root: { padding: '6px 10px' } } },
  },
});

export default theme;
