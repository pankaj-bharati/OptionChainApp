// OptionTable component tests
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptionTable from '../components/OptionTable';

// Formatters matching utils/format.js behaviour (kept inline to avoid import side-effects in tests)
const fmtInt = (v) => (v == null ? '—' : v.toLocaleString('en-IN'));
const fmtFloat = (v) => (v == null ? '—' : Number(v).toFixed(2));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(strikePrice, ceOverrides = {}, peOverrides = {}) {
  return {
    strikePrice,
    CE: {
      impliedVolatility: 12.5,
      lastPrice: 200,
      totalTradedVolume: 5000,
      openInterest: 10000,
      changeinOpenInterest: 100,
      ...ceOverrides,
    },
    PE: {
      impliedVolatility: 11.0,
      lastPrice: 150,
      totalTradedVolume: 4000,
      openInterest: 8000,
      changeinOpenInterest: -50,
      ...peOverrides,
    },
  };
}

const ITEMS = [
  makeItem(23000, { totalTradedVolume: 9000 }, { totalTradedVolume: 3000 }),
  makeItem(23050, { totalTradedVolume: 5000 }, { totalTradedVolume: 7000 }),
  makeItem(23100, { totalTradedVolume: 3000 }, { totalTradedVolume: 9000 }),
];

const defaultProps = {
  items: ITEMS,
  atmStrike: 23050,
  fmtInt,
  fmtFloat,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Header rendering ──────────────────────────────────────────────────────────

describe('OptionTable — header', () => {
  it('renders CALLS and PUTS section headers', () => {
    render(<OptionTable {...defaultProps} />);
    expect(screen.getByText('CALLS')).toBeInTheDocument();
    expect(screen.getByText('PUTS')).toBeInTheDocument();
  });

  it('renders all column sub-headers', () => {
    render(<OptionTable {...defaultProps} />);
    // IV appears twice (once for calls, once for puts)
    expect(screen.getAllByText('IV')).toHaveLength(2);
    expect(screen.getAllByText('LTP')).toHaveLength(2);
    expect(screen.getAllByText('Vol')).toHaveLength(2);
    expect(screen.getAllByText('OI')).toHaveLength(2);
    expect(screen.getAllByText('ΔOI')).toHaveLength(2);
    expect(screen.getByText('STRIKE')).toBeInTheDocument();
  });
});

// ── Row rendering ─────────────────────────────────────────────────────────────

describe('OptionTable — rows', () => {
  it('renders one row per item', () => {
    render(<OptionTable {...defaultProps} />);
    // Each row contains the strike price; check all three are present
    expect(screen.getByText(fmtInt(23000))).toBeInTheDocument();
    expect(screen.getByText(fmtInt(23050))).toBeInTheDocument();
    expect(screen.getByText(fmtInt(23100))).toBeInTheDocument();
  });

  it('applies atm-row class only to the ATM strike row', () => {
    const { container } = render(<OptionTable {...defaultProps} atmStrike={23050} />);
    const atmRows = container.querySelectorAll('tr.atm-row');
    expect(atmRows).toHaveLength(1);
  });

  it('does not apply atm-row class when no strike matches atmStrike', () => {
    const { container } = render(<OptionTable {...defaultProps} atmStrike={99999} />);
    expect(container.querySelectorAll('tr.atm-row')).toHaveLength(0);
  });
});

// ── OI change colour classes ──────────────────────────────────────────────────

describe('OptionTable — OI change colour classes', () => {
  it('applies oi-positive class for positive CE ΔOI', () => {
    const items = [makeItem(23000, { changeinOpenInterest: 200 }, {})];
    const { container } = render(<OptionTable {...defaultProps} items={items} />);
    const cells = container.querySelectorAll('.oi-positive');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('applies oi-negative class for negative PE ΔOI', () => {
    const items = [makeItem(23000, {}, { changeinOpenInterest: -100 })];
    const { container } = render(<OptionTable {...defaultProps} items={items} />);
    const cells = container.querySelectorAll('.oi-negative');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('applies no OI colour class when ΔOI is zero', () => {
    const items = [makeItem(23000, { changeinOpenInterest: 0 }, { changeinOpenInterest: 0 })];
    const { container } = render(<OptionTable {...defaultProps} items={items} />);
    expect(container.querySelectorAll('.oi-positive')).toHaveLength(0);
    expect(container.querySelectorAll('.oi-negative')).toHaveLength(0);
  });
});

// ── Volume highlight ──────────────────────────────────────────────────────────

describe('OptionTable — volume highlight', () => {
  it('applies vol-highlight to the CE row with the highest totalTradedVolume', () => {
    // ITEMS[0] has CE vol 9000 — the max
    const { container } = render(<OptionTable {...defaultProps} />);
    const highlighted = container.querySelectorAll('.vol-highlight');
    // Exactly one CE and one PE cell should be highlighted
    expect(highlighted).toHaveLength(2);
  });

  it('applies vol-cell (not vol-highlight) to non-max volume cells', () => {
    const { container } = render(<OptionTable {...defaultProps} />);
    const normal = container.querySelectorAll('.vol-cell');
    // 3 rows × 2 vol cells = 6 total; 2 are highlighted → 4 are normal
    expect(normal).toHaveLength(4);
  });
});

// ── Formatter delegation ──────────────────────────────────────────────────────

describe('OptionTable — formatter delegation', () => {
  it('uses fmtInt for strike price display', () => {
    const customFmtInt = vi.fn((v) => `INT:${v}`);
    render(<OptionTable {...defaultProps} fmtInt={customFmtInt} />);
    // fmtInt should have been called with each strike price
    const strikeCalls = customFmtInt.mock.calls.map(([v]) => v);
    expect(strikeCalls).toContain(23000);
    expect(strikeCalls).toContain(23050);
    expect(strikeCalls).toContain(23100);
  });

  it('uses fmtFloat for IV display', () => {
    const customFmtFloat = vi.fn((v) => (v == null ? '—' : Number(v).toFixed(2)));
    render(<OptionTable {...defaultProps} fmtFloat={customFmtFloat} />);
    expect(customFmtFloat).toHaveBeenCalled();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('OptionTable — edge cases', () => {
  it('renders without crashing when CE or PE data is absent', () => {
    const items = [{ strikePrice: 23000, CE: null, PE: null }];
    expect(() =>
      render(<OptionTable {...defaultProps} items={items} />)
    ).not.toThrow();
  });

  it('renders a single item without crashing', () => {
    const items = [makeItem(23000)];
    render(<OptionTable {...defaultProps} items={items} />);
    expect(screen.getByText(fmtInt(23000))).toBeInTheDocument();
  });

  it('truncates volume to thousands (Math.trunc)', () => {
    const items = [makeItem(23000, { totalTradedVolume: 7500 }, { totalTradedVolume: 3200 })];
    render(<OptionTable {...defaultProps} items={items} />);
    // 7500 / 1000 = 7.5 → trunc → 7
    expect(screen.getByText('7')).toBeInTheDocument();
    // 3200 / 1000 = 3.2 → trunc → 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
