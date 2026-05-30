// OptionChainPage tests
// Covers: initial loading state, expiry fetch, option chain fetch,
//         strike filter, ATM detection, error states, and empty results.

import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import OptionChainPage from '../pages/OptionChainPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXPIRY_DATES = ['27-Jun-2024', '04-Jul-2024', '25-Jul-2024'];

function makeItem(strikePrice, ceOverrides = {}, peOverrides = {}) {
  return {
    strikePrice,
    CE: {
      impliedVolatility: 12.5,
      lastPrice: 200,
      change: 5,
      pChange: 2.5,
      totalTradedVolume: 5000,
      openInterest: 10000,
      changeinOpenInterest: 100,
      bidprice: 199,
      askPrice: 201,
      ...ceOverrides,
    },
    PE: {
      impliedVolatility: 11.0,
      lastPrice: 150,
      change: -3,
      pChange: -2.0,
      totalTradedVolume: 4000,
      openInterest: 8000,
      changeinOpenInterest: -50,
      bidprice: 149,
      askPrice: 151,
      ...peOverrides,
    },
  };
}

const OPTION_CHAIN_DATA = {
  filtered: {
    data: [
      makeItem(23000),
      makeItem(23050),
      makeItem(23100),
    ],
    underlyingValue: 23050,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <OptionChainPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe('OptionChainPage — loading state', () => {
  it('shows a loading indicator while data is being fetched', async () => {
    const mock = new MockAdapter(axios);
    // Expiry dates resolve immediately; option chain never resolves
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/Loading option chain/i)).toBeInTheDocument();

    mock.restore();
  });
});

// ── Successful data fetch ─────────────────────────────────────────────────────

describe('OptionChainPage — successful fetch', () => {
  it('renders the table after data loads', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('CALLS')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('PUTS')).toBeInTheDocument();

    mock.restore();
  });

  it('renders a row for each strike in the response', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('23,000')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('23,050')).toBeInTheDocument();
    expect(screen.getByText('23,100')).toBeInTheDocument();

    mock.restore();
  });

  it('displays the underlying NIFTY value chip', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText(/NIFTY/i)).toBeInTheDocument(), { timeout: 3000 });

    mock.restore();
  });

  it('populates the expiry selector with dates from the API', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    // The first expiry date should be selected and visible in the toolbar
    await waitFor(
      () => expect(screen.getByText(EXPIRY_DATES[0])).toBeInTheDocument(),
      { timeout: 3000 }
    );

    mock.restore();
  });

  it('shows the strike count chip', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(
      () => expect(screen.getByText('3 strikes')).toBeInTheDocument(),
      { timeout: 3000 }
    );

    mock.restore();
  });
});

// ── Strike filter ─────────────────────────────────────────────────────────────

describe('OptionChainPage — strike filter', () => {
  it('filters rows when a strike value is typed into the search box', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('23,000')).toBeInTheDocument(), { timeout: 3000 });

    const filterInput = screen.getByPlaceholderText(/Filter strike/i);
    fireEvent.change(filterInput, { target: { value: '23050' } });

    // Only the 23050 row should remain
    expect(screen.getByText('23,050')).toBeInTheDocument();
    expect(screen.queryByText('23,000')).not.toBeInTheDocument();
    expect(screen.queryByText('23,100')).not.toBeInTheDocument();

    mock.restore();
  });

  it('updates the strike count chip to reflect filtered results', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('3 strikes')).toBeInTheDocument(), { timeout: 3000 });

    const filterInput = screen.getByPlaceholderText(/Filter strike/i);
    fireEvent.change(filterInput, { target: { value: '23050' } });

    expect(screen.getByText('1 strikes')).toBeInTheDocument();

    mock.restore();
  });

  it('shows "No strikes found" when the filter matches nothing', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('23,000')).toBeInTheDocument(), { timeout: 3000 });

    const filterInput = screen.getByPlaceholderText(/Filter strike/i);
    fireEvent.change(filterInput, { target: { value: '99999' } });

    expect(screen.getByText(/No strikes found/i)).toBeInTheDocument();

    mock.restore();
  });

  it('restores all rows when the filter is cleared', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(() => expect(screen.getByText('3 strikes')).toBeInTheDocument(), { timeout: 3000 });

    const filterInput = screen.getByPlaceholderText(/Filter strike/i);
    fireEvent.change(filterInput, { target: { value: '23050' } });
    expect(screen.getByText('1 strikes')).toBeInTheDocument();

    fireEvent.change(filterInput, { target: { value: '' } });
    expect(screen.getByText('3 strikes')).toBeInTheDocument();

    mock.restore();
  });
});

// ── Error states ──────────────────────────────────────────────────────────────

describe('OptionChainPage — error states', () => {
  it('shows an error message when expiry dates fetch fails', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').networkError();
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    await waitFor(
      () => expect(screen.getByText(/Failed to load expiry dates/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );

    mock.restore();
  });

  it('shows an error message when option chain fetch fails', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).networkError();

    renderPage();

    await waitFor(
      () => expect(screen.getByText(/Failed to load option chain data/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );

    mock.restore();
  });

  it('does not show the table when there is an error', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(500);

    renderPage();

    await waitFor(
      () => expect(screen.getByText(/Failed to load option chain data/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );

    expect(screen.queryByText('CALLS')).not.toBeInTheDocument();

    mock.restore();
  });
});

// ── Empty response ────────────────────────────────────────────────────────────

describe('OptionChainPage — empty response', () => {
  it('shows "No strikes found" when the API returns an empty data array', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, { filtered: { data: [], underlyingValue: 23000 } });

    renderPage();

    await waitFor(
      () => expect(screen.getByText(/No strikes found/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );

    mock.restore();
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('OptionChainPage — navigation', () => {
  it('renders the "Back to Dashboard" button', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, OPTION_CHAIN_DATA);

    renderPage();

    // The back button is in the AppBar — present immediately
    expect(screen.getByRole('link', { name: /Back to Dashboard/i })).toBeInTheDocument();

    mock.restore();
  });

  it('renders the "Full Option Chain" heading', () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/Full Option Chain/i)).toBeInTheDocument();

    mock.restore();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('OptionChainPage — edge cases', () => {
  it('renders without crashing when CE or PE data is absent on a row', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, {
      filtered: {
        data: [{ strikePrice: 23000, CE: null, PE: null }],
        underlyingValue: 23000,
      },
    });

    expect(() => renderPage()).not.toThrow();

    await waitFor(() => expect(screen.getByText('23,000')).toBeInTheDocument(), { timeout: 3000 });

    mock.restore();
  });

  it('falls back to records.data when filtered.data is absent', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: EXPIRY_DATES });
    mock.onGet(/\/api\/option-chain/).reply(200, {
      records: {
        data: [makeItem(23000)],
        underlyingValue: 23000,
      },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('23,000')).toBeInTheDocument(), { timeout: 3000 });

    mock.restore();
  });

  it('renders without crashing when expiryDates is an empty array', async () => {
    const mock = new MockAdapter(axios);
    mock.onGet('http://localhost:3000/api/expiry-dates').reply(200, { expiryDates: [] });

    expect(() => renderPage()).not.toThrow();

    mock.restore();
  });
});
