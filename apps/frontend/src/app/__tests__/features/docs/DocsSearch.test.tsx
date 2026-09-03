import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocsSearch from '@/app/features/docs/DocsSearch';

const INDEX = [
  {
    title: 'User API',
    href: '/docs/apps/backend/api/user',
    section: 'Backend API',
    text: 'requireWebAuth UserController getById organisationId',
  },
  {
    title: 'Design Tokens',
    href: '/docs/ui-system/design-tokens',
    section: 'UI System',
    text: 'colour spacing radius warm bone',
  },
];

describe('DocsSearch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mockIndex = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => INDEX,
    }) as unknown as typeof fetch;
  };

  /* The index is 108 KB, so a reader who never searches must not pay for it. */
  it('does not fetch the index until the field is focused', async () => {
    mockIndex();
    render(<DocsSearch />);
    expect(global.fetch).not.toHaveBeenCalled();

    // Focus starts an async load; flush it inside act so the state update that
    // resolves after this assertion does not warn.
    await act(async () => {
      fireEvent.focus(screen.getByRole('combobox'));
    });
    expect(global.fetch).toHaveBeenCalledWith('/docs/search-index.json');
  });

  it('ranks a title match above a body match', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.change(input, { target: { value: 'user' } });

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('User API');
  });

  it('finds a page by a term that only appears in inline code', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.change(input, { target: { value: 'requireWebAuth' } });

    expect(await screen.findByText('User API')).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.change(input, { target: { value: 'zzzznothing' } });

    expect(await screen.findByText(/No matches/)).toBeInTheDocument();
  });

  /*
   * The failure branch matters: search is an enhancement, and a docs site whose
   * chrome breaks because a JSON fetch 404'd is worse than one without search.
   */
  it('degrades to a browse message when the index cannot be loaded', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'user' } });

    await waitFor(() => expect(screen.getByText(/Search is unavailable/)).toBeInTheDocument());
  });

  it('survives a rejected fetch', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'user' } });

    await waitFor(() => expect(screen.getByText(/Search is unavailable/)).toBeInTheDocument());
  });

  it('shows no panel until something is typed', async () => {
    mockIndex();
    render(<DocsSearch />);
    await act(async () => {
      fireEvent.focus(screen.getByRole('combobox'));
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
