// OIChart component tests
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import OIChart from '../components/OIChart';

// Inline formatter matching utils/format.js
const fmtInt = (v) => (v == null ? '—' : v.toLocaleString('en-IN'));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emptyHistory = { calls: [], puts: [] };

const singleSnapshot = {
  calls: [{ value: 5000, time: '10:00:00' }],
  puts:  [{ value: -3000, time: '10:00:00' }],
};

// Newest-first, as stored in localStorage / state
const multiSnapshot = {
  calls: [
    { value: 6000, time: '10:30:00' },
    { value: 5000, time: '10:00:00' },
    { value: 4000, time: '09:30:00' },
  ],
  puts: [
    { value: -4000, time: '10:30:00' },
    { value: -3000, time: '10:00:00' },
    { value: -2000, time: '09:30:00' },
  ],
};

// Calls heavier than puts (callPct > putPct + 5)
const callsHeavyHistory = {
  calls: [{ value: 90000, time: '10:00:00' }],
  puts:  [{ value: 10000, time: '10:00:00' }],
};

// Puts heavier than calls (putPct > callPct + 5)
const putsHeavyHistory = {
  calls: [{ value: 10000, time: '10:00:00' }],
  puts:  [{ value: 90000, time: '10:00:00' }],
};

// Balanced (within 5% of each other)
const balancedHistory = {
  calls: [{ value: 50000, time: '10:00:00' }],
  puts:  [{ value: 50000, time: '10:00:00' }],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Empty / no-data state ─────────────────────────────────────────────────────

describe('OIChart — empty state', () => {
  it('renders the empty placeholder when history has no data', () => {
    render(<OIChart history={emptyHistory} fmtInt={fmtInt} />);
    expect(screen.getByText(/No OI history yet/i)).toBeInTheDocument();
  });

  it('renders the empty placeholder when history prop is undefined', () => {
    render(<OIChart history={undefined} fmtInt={fmtInt} />);
    expect(screen.getByText(/No OI history yet/i)).toBeInTheDocument();
  });

  it('does not render the main chart segment when there is no data', () => {
    render(<OIChart history={emptyHistory} fmtInt={fmtInt} />);
    expect(screen.queryByText(/ΔOI Weightage/i)).not.toBeInTheDocument();
  });
});

// ── Main chart rendering ──────────────────────────────────────────────────────

describe('OIChart — chart rendering', () => {
  it('renders the section heading when data is present', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/ΔOI Weightage/i)).toBeInTheDocument();
  });

  it('renders the "Latest Snapshot" sub-heading', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/Latest Snapshot/i)).toBeInTheDocument();
  });

  it('renders the "Cumulative Weightage" sub-heading', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/Cumulative Weightage/i)).toBeInTheDocument();
  });

  it('does NOT render the trend chart when there is only one snapshot', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.queryByText(/ΔOI Trend Over Time/i)).not.toBeInTheDocument();
  });

  it('renders the trend chart heading when there are multiple snapshots', () => {
    render(<OIChart history={multiSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/ΔOI Trend Over Time/i)).toBeInTheDocument();
  });
});

// ── Trade signal banner ───────────────────────────────────────────────────────

describe('OIChart — trade signal', () => {
  it('shows bearish message when calls are significantly heavier', () => {
    render(<OIChart history={callsHeavyHistory} fmtInt={fmtInt} />);
    expect(screen.getByText(/BEARISH/i)).toBeInTheDocument();
    expect(screen.getByText(/Heavy Call writing/i)).toBeInTheDocument();
  });

  it('shows bullish message when puts are significantly heavier', () => {
    render(<OIChart history={putsHeavyHistory} fmtInt={fmtInt} />);
    expect(screen.getByText(/BULLISH/i)).toBeInTheDocument();
    expect(screen.getByText(/Heavy Put writing/i)).toBeInTheDocument();
  });

  it('shows neutral / no clear bias message when sides are within 5%', () => {
    render(<OIChart history={balancedHistory} fmtInt={fmtInt} />);
    expect(screen.getByText(/NEUTRAL/i)).toBeInTheDocument();
    expect(screen.getByText(/Balanced OI/i)).toBeInTheDocument();
  });

  it('renders the neutral banner without a SUI color class (grey is passed as undefined)', () => {
    const { container } = render(<OIChart history={balancedHistory} fmtInt={fmtInt} />);
    // SUI Message applies a class like "red" or "green" when color prop is set.
    // For the neutral signal, color='grey' is mapped to undefined so no colour class is added.
    const message = container.querySelector('.ui.message');
    expect(message).toBeInTheDocument();
    expect(message.classList).not.toContain('grey');
    expect(message.classList).not.toContain('pink');
  });

  it('renders the bearish banner with the red SUI color class', () => {
    const { container } = render(<OIChart history={callsHeavyHistory} fmtInt={fmtInt} />);
    const message = container.querySelector('.ui.message');
    expect(message).toBeInTheDocument();
    expect(message.classList).toContain('red');
  });

  it('renders the bullish banner with the green SUI color class', () => {
    const { container } = render(<OIChart history={putsHeavyHistory} fmtInt={fmtInt} />);
    const message = container.querySelector('.ui.message');
    expect(message).toBeInTheDocument();
    expect(message.classList).toContain('green');
  });

  it('does not render a signal banner when there is no data', () => {
    render(<OIChart history={emptyHistory} fmtInt={fmtInt} />);
    expect(screen.queryByText(/BEARISH/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BULLISH/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NEUTRAL/i)).not.toBeInTheDocument();
  });
});

// ── Cumulative totals display ─────────────────────────────────────────────────

describe('OIChart — cumulative totals', () => {
  it('displays total Call ΔOI label', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/Total Call ΔOI/i)).toBeInTheDocument();
  });

  it('displays total Put ΔOI label', () => {
    render(<OIChart history={singleSnapshot} fmtInt={fmtInt} />);
    expect(screen.getByText(/Total Put ΔOI/i)).toBeInTheDocument();
  });

  it('uses fmtInt to format cumulative totals', () => {
    const customFmtInt = vi.fn((v) => `FMT:${v}`);
    render(<OIChart history={singleSnapshot} fmtInt={customFmtInt} />);
    expect(customFmtInt).toHaveBeenCalled();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('OIChart — edge cases', () => {
  it('renders without crashing when calls array is empty but puts has data', () => {
    const history = { calls: [], puts: [{ value: 3000, time: '10:00:00' }] };
    expect(() => render(<OIChart history={history} fmtInt={fmtInt} />)).not.toThrow();
    expect(screen.getByText(/ΔOI Weightage/i)).toBeInTheDocument();
  });

  it('renders without crashing when puts array is empty but calls has data', () => {
    const history = { calls: [{ value: 3000, time: '10:00:00' }], puts: [] };
    expect(() => render(<OIChart history={history} fmtInt={fmtInt} />)).not.toThrow();
    expect(screen.getByText(/ΔOI Weightage/i)).toBeInTheDocument();
  });

  it('renders without crashing when calls and puts have different lengths', () => {
    const history = {
      calls: [{ value: 5000, time: '10:30:00' }, { value: 4000, time: '10:00:00' }],
      puts:  [{ value: -2000, time: '10:30:00' }],
    };
    expect(() => render(<OIChart history={history} fmtInt={fmtInt} />)).not.toThrow();
  });

  it('handles zero values without crashing', () => {
    const history = {
      calls: [{ value: 0, time: '10:00:00' }],
      puts:  [{ value: 0, time: '10:00:00' }],
    };
    expect(() => render(<OIChart history={history} fmtInt={fmtInt} />)).not.toThrow();
  });

  it('handles negative call values without crashing', () => {
    const history = {
      calls: [{ value: -8000, time: '10:00:00' }],
      puts:  [{ value: -3000, time: '10:00:00' }],
    };
    expect(() => render(<OIChart history={history} fmtInt={fmtInt} />)).not.toThrow();
  });
});
