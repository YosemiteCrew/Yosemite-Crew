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

  it('selects results with the keyboard and activates the selected link', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.change(input, { target: { value: 'api' } });

    const option = await screen.findByRole('option', { name: /User API/ });
    const click = jest.spyOn(option, 'click').mockImplementation(() => undefined);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('clamps arrow navigation and resets selection when the query changes', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.change(input, { target: { value: 'i' } });
    const options = await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'End' });
    expect(options.at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options.at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(input, { target: { value: 'user' } });
    await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'));
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
  });

  it('retries a failed load once and preserves the query', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => INDEX }) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'user' } });
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);

    expect(await screen.findByRole('option', { name: /User API/ })).toBeInTheDocument();
    expect(input).toHaveValue('user');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated load attempts while a request is pending', () => {
    global.fetch = jest
      .fn()
      .mockReturnValue(new Promise(() => undefined)) as unknown as typeof fetch;
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.focus(input);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
