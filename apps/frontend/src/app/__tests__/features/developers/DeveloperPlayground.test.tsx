import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('next/link', () => {
  const Link = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return { __esModule: true, default: Link };
});

import DeveloperPlayground from '@/app/features/developers/pages/DeveloperPlayground/DeveloperPlayground';

const BASE = 'https://api.example.test';
const KEY = 'synthetic-playground-key';

type FakeResponse = { status: number; body: string; headers?: Record<string, string> };

const respond = ({ status, body, headers = {} }: FakeResponse) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as any).fetch = fetchMock;
});

const fill = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const chooseOperation = (id: string) =>
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: id } });

const run = () => fireEvent.click(screen.getByRole('button', { name: 'Run' }));

describe('DeveloperPlayground', () => {
  it('runs an operation with the key as a bearer token and no session cookie', async () => {
    fetchMock.mockResolvedValue(
      respond({
        status: 200,
        body: JSON.stringify({ data: [{ id: 'org-synthetic', name: 'Synthetic Vets' }] }),
        headers: { 'x-request-id': 'req-123' },
      })
    );
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    run();

    await waitFor(() => expect(screen.getByTestId('playground-status')).toHaveTextContent('200'));
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/v1/developer/organizations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KEY}` },
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByText('req-123')).toBeInTheDocument();
    const responseBody = screen.getByLabelText('Response body');
    expect(responseBody).toHaveTextContent('"Synthetic Vets"');
    expect(responseBody).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The practices it returned are offered in the x-org-id field.
    chooseOperation('listAppointments');
    const orgInput = screen.getByLabelText(/Practice \(x-org-id\)/);
    const listId = orgInput.getAttribute('list');
    expect(listId).toBeTruthy();
    expect(document.getElementById(listId as string)?.querySelector('option')).toHaveValue(
      'org-synthetic'
    );
  });

  it('does not send without a key', () => {
    render(<DeveloperPlayground baseUrl={BASE} />);
    run();
    expect(screen.getByText('Paste an API key from the API keys page.')).toBeInTheDocument();
    expect(screen.getByLabelText('API key')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the key out of the page URL, storage and every export', async () => {
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    for (const tab of ['cURL', 'TypeScript', 'Request fixture']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      const panel = screen.getByRole('tabpanel');
      expect(panel.textContent).toContain('YC_API_KEY');
      expect(panel.textContent).not.toContain(KEY);
    }
    expect(globalThis.location.href).not.toContain(KEY);
    expect(JSON.stringify({ ...globalThis.localStorage })).not.toContain(KEY);
  });

  it('validates inputs before sending and marks the field', () => {
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    chooseOperation('listAppointments');
    fill('Page size', '500');
    run();

    expect(screen.getByText('Practice (x-org-id) is required.')).toBeInTheDocument();
    expect(screen.getByText('Use a whole number from 1 to 100.')).toBeInTheDocument();
    expect(screen.getByLabelText('Page size')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();

    // Editing a field clears its error.
    fill('Page size', '5');
    expect(screen.queryByText('Use a whole number from 1 to 100.')).not.toBeInTheDocument();
  });

  it('explains an error response and keeps the inputs', async () => {
    fetchMock.mockResolvedValue(
      respond({ status: 401, body: JSON.stringify({ message: 'Invalid or expired API key' }) })
    );
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    chooseOperation('getAppointment');
    fill(/Appointment id/, 'appt-1');
    fill(/Practice \(x-org-id\)/, 'org-synthetic');
    run();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The key was missing, invalid, revoked or expired. The API said: "Invalid or expired API key".'
    );
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/v1/developer/appointments/appt-1`);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'x-org-id': 'org-synthetic',
      Authorization: `Bearer ${KEY}`,
    });
    expect(screen.getByLabelText(/Appointment id/)).toHaveValue('appt-1');
  });

  it('pages with the returned cursor', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond({
          status: 200,
          body: JSON.stringify({ data: [], pagination: { limit: 1, nextCursor: 'cursor-2' } }),
        })
      )
      .mockResolvedValueOnce(
        respond({
          status: 200,
          body: JSON.stringify({ data: [], pagination: { limit: 1, nextCursor: null } }),
        })
      );
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    chooseOperation('listAppointments');
    fill(/Practice \(x-org-id\)/, 'org-synthetic');
    fill('Page size', '1');
    run();

    fireEvent.click(await screen.findByRole('button', { name: 'Load next page' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${BASE}/v1/developer/appointments?limit=1&cursor=cursor-2`
    );
    expect(screen.getByLabelText('Cursor')).toHaveValue('cursor-2');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load next page' })).not.toBeInTheDocument()
    );
  });

  it('cancels an in-flight request without losing the draft', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    chooseOperation('listAppointments');
    fill(/Practice \(x-org-id\)/, 'org-synthetic');
    run();

    expect(await screen.findByText('Waiting for the API...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Running...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByText('Request cancelled. Your inputs are unchanged.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Practice \(x-org-id\)/)).toHaveValue('org-synthetic');
    expect(screen.getByLabelText('API key')).toHaveValue(KEY);
  });

  it('reports a request that never reached the API', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    run();
    expect(await screen.findByRole('alert')).toHaveTextContent('did not reach the API');
    expect(screen.getByTestId('playground-status')).toHaveTextContent('No response');
  });

  it('keeps each operation draft when switching between them', () => {
    render(<DeveloperPlayground baseUrl={BASE} />);
    chooseOperation('getAppointment');
    fill(/Appointment id/, 'appt-1');
    chooseOperation('getUsage');
    expect(screen.queryByLabelText(/Appointment id/)).not.toBeInTheDocument();
    chooseOperation('getAppointment');
    expect(screen.getByLabelText(/Appointment id/)).toHaveValue('appt-1');
  });

  it('clears a result on request', async () => {
    fetchMock.mockResolvedValue(respond({ status: 200, body: '{"data":{"used":1}}' }));
    render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    chooseOperation('getUsage');
    run();
    await screen.findByTestId('playground-status');
    fireEvent.click(screen.getByRole('button', { name: 'Clear result' }));
    expect(screen.queryByTestId('playground-status')).not.toBeInTheDocument();
    expect(screen.getByText('Run an operation to see its response here.')).toBeInTheDocument();
  });

  it('sends nothing when the portal has no API address', () => {
    render(<DeveloperPlayground baseUrl="" />);
    fill('API key', KEY);
    run();
    expect(
      screen.getByText('This portal has no API address configured, so nothing can be sent.')
    ).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('No API address is configured');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('copies the current export', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<DeveloperPlayground baseUrl={BASE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(writeText.mock.calls[0][0]).toContain(`'${BASE}/v1/developer/organizations'`);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('aborts an in-flight request on unmount', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {});
    });
    const { unmount } = render(<DeveloperPlayground baseUrl={BASE} />);
    fill('API key', KEY);
    run();
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
