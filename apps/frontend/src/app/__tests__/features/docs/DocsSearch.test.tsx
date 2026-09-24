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
    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: async () => (String(input) === '/api/docs/rerank' ? { order: null } : INDEX),
      })
    ) as unknown as typeof fetch;
  };

  /* The index is 108 KB, so a reader who never searches must not pay for it. */
  it('does not fetch the index until the field is focused', async () => {
    mockIndex();
    render(<DocsSearch />);
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });

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

  it('applies a successful order only to retrieved candidates', async () => {
    const tokenDoc = {
      title: 'API tokens',
      href: '/docs/apps/backend/api/tokens',
      section: 'Backend API',
      text: 'User credential tokens',
    };
    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: async () => {
          if (String(input) === '/docs/search-index.json') return [INDEX[0], tokenDoc];
          return { order: [tokenDoc.href, INDEX[0].href, '/docs/outside-candidates'] };
        },
      })
    ) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user key' } });

    expect(await screen.findByRole('option', { name: /User API/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/rerank',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ query: 'user key' }) })
      )
    );
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'API tokensBackend API',
        'User APIBackend API',
      ])
    );
    expect(screen.queryByText('outside-candidates')).not.toBeInTheDocument();

    const firstResult = screen.getByRole('option', { name: /API tokens/ });
    fireEvent.click(firstResult);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await act(async () => fireEvent.focus(input));
    const reopenedResult = screen.getByRole('option', { name: /API tokens/ });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(reopenedResult).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('keeps the keyboard selection on the same result when reranking reorders it', async () => {
    const tokenDoc = {
      title: 'API tokens',
      href: '/docs/apps/backend/api/tokens',
      section: 'Backend API',
      text: 'User credential tokens',
    };
    let resolveRerank!: (value: { ok: true; json: () => Promise<{ order: string[] }> }) => void;
    const rerankResponse = new Promise<{ ok: true; json: () => Promise<{ order: string[] }> }>(
      (resolve) => {
        resolveRerank = resolve;
      }
    );
    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        String(input) === '/api/docs/rerank'
          ? rerankResponse
          : Promise.resolve({ ok: true, json: async () => [INDEX[0], tokenDoc] })
      ) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user' } });
    const selected = await screen.findByRole('option', { name: /User API/ });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(selected).toHaveAttribute('aria-selected', 'true');

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/rerank',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await act(async () => {
      resolveRerank({
        ok: true,
        json: async () => ({ order: [tokenDoc.href, INDEX[0].href] }),
      });
    });

    await waitFor(() =>
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'API tokensBackend API',
        'User APIBackend API',
      ])
    );
    const movedSelection = screen.getByRole('option', { name: /User API/ });
    expect(movedSelection).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', movedSelection.id);
  });

  it('clears the keyboard selection when reranking removes that result', async () => {
    const tokenDoc = {
      title: 'API tokens',
      href: '/docs/apps/backend/api/tokens',
      section: 'Backend API',
      text: 'User credential tokens',
    };
    let resolveRerank!: (value: { ok: true; json: () => Promise<{ order: string[] }> }) => void;
    const rerankResponse = new Promise<{ ok: true; json: () => Promise<{ order: string[] }> }>(
      (resolve) => {
        resolveRerank = resolve;
      }
    );
    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        String(input) === '/api/docs/rerank'
          ? rerankResponse
          : Promise.resolve({ ok: true, json: async () => [INDEX[0], tokenDoc] })
      ) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user' } });
    await screen.findByRole('option', { name: /User API/ });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveRerank({ ok: true, json: async () => ({ order: [tokenDoc.href] }) });
    });

    await waitFor(() => expect(screen.queryByRole('option', { name: /User API/ })).toBeNull());
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByRole('option', { name: /API tokens/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it.each([
    ['null result', null],
    ['HTTP failure', 'http-failure'],
    ['non-array order', { order: 'invalid' }],
    ['non-string href', { order: [42] }],
    ['outside candidate', { order: ['/docs/not-in-candidates'] }],
    ['empty order', { order: [] }],
  ])('ignores a %s from the reranker', async (_caseName, rerankResult) => {
    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === '/api/docs/rerank' && rerankResult === 'http-failure') {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({
        ok: true,
        json: async () => (String(input) === '/api/docs/rerank' ? rerankResult : INDEX),
      });
    }) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user' } });
    expect(await screen.findByRole('option', { name: /User API/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/rerank',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 150)));

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /User API/ })).toBeInTheDocument();
  });

  it('closes the results on Escape and outside press while keeping internal clicks open', async () => {
    mockIndex();
    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user' } });
    expect(await screen.findByRole('option', { name: /User API/ })).toBeInTheDocument();

    fireEvent.mouseDown(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps deterministic results when the rerank request rejects', async () => {
    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        String(input) === '/api/docs/rerank'
          ? Promise.reject(new Error('offline'))
          : Promise.resolve({ ok: true, json: async () => INDEX })
      ) as unknown as typeof fetch;

    render(<DocsSearch />);
    const input = screen.getByRole('combobox');
    await act(async () => fireEvent.focus(input));
    fireEvent.change(input, { target: { value: 'user' } });
    expect(await screen.findByRole('option', { name: /User API/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/rerank',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 150)));

    expect(screen.getByRole('option', { name: /User API/ })).toBeInTheDocument();
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
    fireEvent.keyDown(input, { key: 'ArrowDown' });
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
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
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

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
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
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => url === '/docs/search-index.json')
    ).toHaveLength(2);
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
