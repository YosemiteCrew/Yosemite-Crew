import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/services/developerApiKeys', () => ({
  listApiKeys: jest.fn(),
  createApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
}));

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick, type, isDisabled }: any) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import DeveloperApiKeys from '@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys';
import { listApiKeys, createApiKey, revokeApiKey } from '@/app/services/developerApiKeys';

const listApiKeysMock = listApiKeys as jest.Mock;
const createApiKeyMock = createApiKey as jest.Mock;
const revokeApiKeyMock = revokeApiKey as jest.Mock;

const sampleKey = {
  id: 'k1',
  name: 'Prod',
  prefix: 'yc_live_abc',
  last4: 'wxyz',
  scopes: [],
  environment: 'live',
  status: 'active',
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

// userEvent.setup() installs its own navigator.clipboard, so clipboard tests
// define their mock AFTER setup() and assert against that local mock.
const mockClipboard = (writeText: jest.Mock) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });

beforeEach(() => {
  jest.clearAllMocks();
  listApiKeysMock.mockResolvedValue([]);
});

const openCreateForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByTestId('api-keys-empty');
  await user.click(screen.getByRole('button', { name: 'Create API key' }));
};

describe('DeveloperApiKeys page', () => {
  it('shows the empty state when there are no keys', async () => {
    render(<DeveloperApiKeys />);
    expect(await screen.findByTestId('api-keys-empty')).toBeInTheDocument();
    expect(listApiKeysMock).toHaveBeenCalledTimes(1);
  });

  it('renders the keys table', async () => {
    listApiKeysMock.mockResolvedValue([sampleKey]);
    render(<DeveloperApiKeys />);
    expect(await screen.findByText('Prod')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    listApiKeysMock.mockRejectedValue(new Error('boom'));
    render(<DeveloperApiKeys />);
    expect(await screen.findByText(/Could not load your API keys/)).toBeInTheDocument();
  });

  it('creates a key, parses scopes, and reveals the secret once', async () => {
    const user = userEvent.setup();
    createApiKeyMock.mockResolvedValue({
      apiKey: 'yc_live_THE_SECRET',
    });
    render(<DeveloperApiKeys />);
    await openCreateForm(user);

    await user.type(screen.getByLabelText('Key name'), 'CI');
    await user.type(screen.getByLabelText(/Scopes/), 'appointments:read, inventory:read');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByTestId('issued-secret')).toHaveTextContent('yc_live_THE_SECRET');
    expect(createApiKeyMock).toHaveBeenCalledWith({
      name: 'CI',
      environment: 'live',
      scopes: ['appointments:read', 'inventory:read'],
    });
    await waitFor(() => expect(listApiKeysMock).toHaveBeenCalledTimes(2));
  });

  it('disables Create until a name is entered', async () => {
    const user = userEvent.setup();
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('copies the issued secret and reflects the copied state', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    createApiKeyMock.mockResolvedValue({ apiKey: 'yc_live_SECRET' });
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText('Key name'), 'CI');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('issued-secret');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('yc_live_SECRET');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('stays on Copy when the clipboard write fails', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    mockClipboard(writeText);
    createApiKeyMock.mockResolvedValue({ apiKey: 'yc_live_SECRET' });
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText('Key name'), 'CI');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('issued-secret');

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument());
  });

  it('dismisses the reveal with Done', async () => {
    const user = userEvent.setup();
    createApiKeyMock.mockResolvedValue({ apiKey: 'yc_live_SECRET' });
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText('Key name'), 'CI');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByTestId('issued-secret');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('issued-secret')).not.toBeInTheDocument());
  });

  it('shows an error when creation fails', async () => {
    const user = userEvent.setup();
    createApiKeyMock.mockRejectedValue(new Error('nope'));
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText('Key name'), 'CI');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText(/Could not create the API key/)).toBeInTheDocument();
  });

  it('cancels the form', async () => {
    const user = userEvent.setup();
    render(<DeveloperApiKeys />);
    await openCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Key name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create API key' })).toBeInTheDocument();
  });

  it('revokes an active key and reloads', async () => {
    const user = userEvent.setup();
    listApiKeysMock.mockResolvedValueOnce([sampleKey]).mockResolvedValueOnce([]);
    revokeApiKeyMock.mockResolvedValue(undefined);
    render(<DeveloperApiKeys />);
    await screen.findByText('Prod');

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(revokeApiKeyMock).toHaveBeenCalledWith('k1');
    expect(await screen.findByTestId('api-keys-empty')).toBeInTheDocument();
  });

  it('shows an error when revoke fails', async () => {
    const user = userEvent.setup();
    listApiKeysMock.mockResolvedValue([sampleKey]);
    revokeApiKeyMock.mockRejectedValue(new Error('x'));
    render(<DeveloperApiKeys />);
    await screen.findByText('Prod');

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText(/Could not revoke the API key/)).toBeInTheDocument();
  });
});
