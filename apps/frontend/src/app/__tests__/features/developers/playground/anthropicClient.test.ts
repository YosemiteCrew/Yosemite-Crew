import {
  ANTHROPIC_API_URL,
  ANTHROPIC_VERSION,
  AnthropicRequestError,
  MAX_RESPONSE_TOKENS,
  PLAYGROUND_SYSTEM_PROMPT,
  sendAnthropicMessage,
  type ChatMessage,
} from '@/app/features/developers/playground/anthropicClient';
import { PLAYGROUND_TOOLS } from '@/app/features/developers/playground/playgroundTools';

const fetchMock = jest.fn();

const messages: ChatMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }];

const params = {
  apiKey: 'sk-ant-fake',
  model: 'claude-sonnet-5',
  messages,
  tools: PLAYGROUND_TOOLS,
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('sendAnthropicMessage', () => {
  test('posts a non-streaming request with the direct browser access header', async () => {
    const apiResponse = {
      content: [{ type: 'text', text: 'Hi there' }],
      stop_reason: 'end_turn',
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(apiResponse),
    });

    const result = await sendAnthropicMessage(params);

    expect(result).toEqual(apiResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ANTHROPIC_API_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'sk-ant-fake',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.max_tokens).toBe(MAX_RESPONSE_TOKENS);
    expect(body.system).toBe(PLAYGROUND_SYSTEM_PROMPT);
    expect(body.messages).toEqual(messages);
    expect(body.tools.map((tool: { name: string }) => tool.name)).toContain('list_appointments');
    expect(body.stream).toBeUndefined();
  });

  test('throws a readable error when the network is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(sendAnthropicMessage(params)).rejects.toThrow('Could not reach the Anthropic API');
    await expect(sendAnthropicMessage(params)).rejects.toBeInstanceOf(AnthropicRequestError);
  });

  test('surfaces the Anthropic error envelope message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'messages: roles must alternate' },
      }),
    });

    await expect(sendAnthropicMessage(params)).rejects.toThrow(
      'Anthropic API error: messages: roles must alternate'
    );
  });

  test('adds a key hint on 401 responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: { message: 'invalid x-api-key' } }),
    });

    await expect(sendAnthropicMessage(params)).rejects.toThrow(
      /invalid x-api-key.*Check the Anthropic API key/
    );
  });

  test('falls back to the HTTP status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 529,
      json: jest.fn().mockRejectedValue(new Error('not json')),
    });

    await expect(sendAnthropicMessage(params)).rejects.toThrow(
      'Anthropic API request failed (HTTP 529).'
    );
  });

  test('keeps the status message when the envelope has no string message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: { message: 42 } }),
    });

    await expect(sendAnthropicMessage(params)).rejects.toThrow(
      'Anthropic API request failed (HTTP 500).'
    );
  });
});
