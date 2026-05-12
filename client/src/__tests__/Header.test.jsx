// Header component tests
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Header from '../components/Header';

// Default props that satisfy all required slots
const defaultProps = {
  underlyingValue: 24500,
  itemChainData: 5,
  setItemChainData: vi.fn(),
  expiryDates: ['25-Jul-2024', '01-Aug-2024'],
  selectedExpiry: '25-Jul-2024',
  setSelectedExpiry: vi.fn(),
  secondsRemaining: 15,
  progress: 0.5,
  onLogout: undefined,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Header', () => {
  it('renders the underlying value', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('24500')).toBeInTheDocument();
  });

  it('renders "—" when underlyingValue is null', () => {
    render(<Header {...defaultProps} underlyingValue={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the window size selector with the correct value selected', () => {
    render(<Header {...defaultProps} itemChainData={4} />);
    const select = screen.getByLabelText(/window/i);
    expect(select).toHaveValue('4');
  });

  it('calls setItemChainData with a number when window size changes', async () => {
    const setItemChainData = vi.fn();
    render(<Header {...defaultProps} setItemChainData={setItemChainData} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/window/i), '7');
    expect(setItemChainData).toHaveBeenCalledWith(7);
  });

  it('renders the expiry selector with the correct value selected', () => {
    render(<Header {...defaultProps} />);
    const select = screen.getByLabelText(/expiry/i);
    expect(select).toHaveValue('25-Jul-2024');
  });

  it('calls setSelectedExpiry when expiry changes', async () => {
    const setSelectedExpiry = vi.fn();
    render(<Header {...defaultProps} setSelectedExpiry={setSelectedExpiry} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/expiry/i), '01-Aug-2024');
    expect(setSelectedExpiry).toHaveBeenCalledWith('01-Aug-2024');
  });

  it('renders the countdown seconds', () => {
    render(<Header {...defaultProps} secondsRemaining={22} />);
    expect(screen.getByText('22')).toBeInTheDocument();
  });

  // --- Logout button (Requirement 3.1, 3.2) ---

  it('does NOT render a Logout button when onLogout is not provided', () => {
    render(<Header {...defaultProps} onLogout={undefined} />);
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('renders a Logout button when onLogout prop is provided', () => {
    render(<Header {...defaultProps} onLogout={vi.fn()} />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('calls onLogout when the Logout button is clicked', async () => {
    const onLogout = vi.fn();
    render(<Header {...defaultProps} onLogout={onLogout} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
