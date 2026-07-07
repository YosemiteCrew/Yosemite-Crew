import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { runAgentTurn } from '@/app/features/developers/playground/agentLoop';
import type { ChatMessage } from '@/app/features/developers/playground/anthropicClient';
import { PLAYGROUND_STORAGE_KEYS } from '@/app/features/developers/playground/playgroundSession';

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

jest.mock('@/app/features/developers/playground/agentLoop', () => ({
  ...jest.requireActual('@/app/features/developers/playground/agentLoop'),
  runAgentTurn: jest.fn(),
}));

import DeveloperPlayground from '@/app/features/developers/pages/DeveloperPlayground/DeveloperPlayground';

const runAgentTurnMock = runAgentTurn as jest.Mock;

const seedKeys = () => {
  window.sessionStorage.setItem(PLAYGROUND_STORAGE_KEYS.anthropicKey, 'sk-ant-fake');
  window.sessionStorage.setItem(PLAYGROUND_STORAGE_KEYS.yosemiteKey, 'yc_test_fake');
};

const sendMessage = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.type(screen.getByPlaceholderText('Ask about your clinic data...'), text);
  await user.click(screen.getByRole('button', { name: 'Send' }));
};

beforeEach(() => {
  runAgentTurnMock.mockReset();
  window.sessionStorage.clear();
});

describe('DeveloperPlayground page', () => {
  test('renders inside the dev route guard with setup panel, empty state, and footer note', () => {
    render(<DeveloperPlayground />);

    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent Playground' })).toBeInTheDocument();
    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
    expect(screen.getByLabelText('Yosemite API key')).toBeInTheDocument();
    expect(screen.getByLabelText('API base URL')).toHaveValue('http://localhost:8000');
    expect(screen.getByLabelText('Model')).toHaveValue('claude-sonnet-5');
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    expect(
      screen.getByText(/same read-only tools the upcoming AI editing agent will use/)
    ).toBeInTheDocument();
    expect(screen.getByText(/session storage only/)).toBeInTheDocument();
  });

  test('hydrates settings from sessionStorage', async () => {
    seedKeys();
    window.sessionStorage.setItem(PLAYGROUND_STORAGE_KEYS.baseUrl, 'http://localhost:9111');
    window.sessionStorage.setItem(PLAYGROUND_STORAGE_KEYS.model, 'claude-haiku-4-5-20251001');

    render(<DeveloperPlayground />);

    await waitFor(() => {
      expect(screen.getByLabelText('API base URL')).toHaveValue('http://localhost:9111');
    });
    expect(screen.getByLabelText('Model')).toHaveValue('claude-haiku-4-5-20251001');
    expect(screen.getByLabelText('Anthropic API key')).toHaveValue('sk-ant-fake');
  });

  test('persists edited settings to sessionStorage and never to localStorage', async () => {
    const user = userEvent.setup();
    render(<DeveloperPlayground />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-ant-typed');
    await user.type(screen.getByLabelText('Yosemite API key'), 'yc_test_typed');
    await user.type(screen.getByLabelText('API base URL'), '/extra');
    await user.selectOptions(screen.getByLabelText('Model'), 'claude-haiku-4-5-20251001');

    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBe(
      'sk-ant-typed'
    );
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.yosemiteKey)).toBe(
      'yc_test_typed'
    );
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.baseUrl)).toBe(
      'http://localhost:8000/extra'
    );
    expect(window.sessionStorage.getItem(PLAYGROUND_STORAGE_KEYS.model)).toBe(
      'claude-haiku-4-5-20251001'
    );
    expect(window.localStorage.getItem(PLAYGROUND_STORAGE_KEYS.anthropicKey)).toBeNull();
    expect(window.localStorage.getItem(PLAYGROUND_STORAGE_KEYS.yosemiteKey)).toBeNull();
  });

  test('blocks sending until both keys are configured', async () => {
    const user = userEvent.setup();
    render(<DeveloperPlayground />);

    await sendMessage(user, 'Hello');

    expect(runAgentTurnMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Add both API keys in the setup panel before starting a conversation.'
    );
  });

  test('ignores empty drafts', async () => {
    seedKeys();
    const user = userEvent.setup();
    render(<DeveloperPlayground />);

    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(runAgentTurnMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('runs an agent turn and renders the assistant reply', async () => {
    seedKeys();
    const user = userEvent.setup();
    runAgentTurnMock.mockImplementation(async (history: ChatMessage[]) => [
      ...history,
      { role: 'assistant', content: [{ type: 'text', text: 'You have 2 patients.' }] },
    ]);

    render(<DeveloperPlayground />);
    await sendMessage(user, 'How many patients?');

    expect(await screen.findByText('You have 2 patients.')).toBeInTheDocument();
    expect(screen.getByText('How many patients?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about your clinic data...')).toHaveValue('');

    const [history, config] = runAgentTurnMock.mock.calls[0];
    expect(history).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'How many patients?' }] },
    ]);
    expect(config).toEqual({
      anthropicKey: 'sk-ant-fake',
      yosemiteKey: 'yc_test_fake',
      baseUrl: 'http://localhost:8000',
      model: 'claude-sonnet-5',
    });
  });

  test('renders tool call and tool error blocks reported through progress updates', async () => {
    seedKeys();
    const user = userEvent.setup();
    runAgentTurnMock.mockImplementation(
      async (
        history: ChatMessage[],
        _config: unknown,
        onProgress?: (messages: ChatMessage[]) => void
      ) => {
        const withTools: ChatMessage[] = [
          ...history,
          {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'list_appointments', input: {} }],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                content: 'Per-key rate limit hit.',
                is_error: true,
              },
            ],
          },
        ];
        onProgress?.(withTools);
        return [
          ...withTools,
          { role: 'assistant', content: [{ type: 'text', text: 'The API rate limited us.' }] },
        ];
      }
    );

    render(<DeveloperPlayground />);
    await sendMessage(user, 'List appointments');

    expect(await screen.findByText('The API rate limited us.')).toBeInTheDocument();
    expect(screen.getByText('Tool call: list_appointments')).toBeInTheDocument();
    expect(screen.getByText(/Tool error: Per-key rate limit hit\./)).toBeInTheDocument();
  });

  test('renders successful tool results truncated', async () => {
    seedKeys();
    const user = userEvent.setup();
    const longBody = `{"data":"${'x'.repeat(400)}"}`;
    runAgentTurnMock.mockImplementation(async (history: ChatMessage[]) => [
      ...history,
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_2', content: longBody },
          { type: 'tool_result', tool_use_id: 'toolu_3', content: '{"short":true}' },
        ],
      },
    ]);

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Show raw data');

    const results = await screen.findAllByText(/^Tool result: /);
    expect(results[0].textContent?.endsWith('...')).toBe(true);
    expect(results[0].textContent?.length).toBeLessThan(longBody.length);
    expect(results[1]).toHaveTextContent('Tool result: {"short":true}');
  });

  test('shows the error notice when the agent turn fails and keeps the user message', async () => {
    seedKeys();
    const user = userEvent.setup();
    runAgentTurnMock.mockRejectedValue(new Error('Anthropic API error: overloaded'));

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Hello');

    expect(await screen.findByRole('alert')).toHaveTextContent('Anthropic API error: overloaded');
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  test('shows a generic notice for non-Error failures', async () => {
    seedKeys();
    const user = userEvent.setup();
    runAgentTurnMock.mockRejectedValue('boom');

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Hello');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong while contacting the Anthropic API.'
    );
  });

  test('disables sending and shows a thinking indicator while a turn is running', async () => {
    seedKeys();
    const user = userEvent.setup();
    let resolveTurn: (messages: ChatMessage[]) => void = () => undefined;
    runAgentTurnMock.mockImplementation(
      (history: ChatMessage[]) =>
        new Promise<ChatMessage[]>((resolve) => {
          resolveTurn = () => resolve(history);
        })
    );

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Slow question');

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    resolveTurn([]);
    await waitFor(() => {
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });
  });

  test('falls back to the default base URL when the field is blank', async () => {
    seedKeys();
    window.sessionStorage.setItem(PLAYGROUND_STORAGE_KEYS.baseUrl, '   ');
    const user = userEvent.setup();
    runAgentTurnMock.mockImplementation(async (history: ChatMessage[]) => history);

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Hello');

    await waitFor(() => expect(runAgentTurnMock).toHaveBeenCalled());
    expect(runAgentTurnMock.mock.calls[0][1].baseUrl).toBe('http://localhost:8000');
  });

  test('clear conversation resets messages and notices', async () => {
    seedKeys();
    const user = userEvent.setup();
    runAgentTurnMock.mockImplementation(async (history: ChatMessage[]) => [
      ...history,
      { role: 'assistant', content: [{ type: 'text', text: 'Reply text.' }] },
    ]);

    render(<DeveloperPlayground />);
    await sendMessage(user, 'Hi');
    expect(await screen.findByText('Reply text.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));

    expect(screen.queryByText('Reply text.')).not.toBeInTheDocument();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });
});
