import {
  MAX_TOOL_ITERATIONS,
  runAgentTurn,
  type AgentTurnConfig,
} from '@/app/features/developers/playground/agentLoop';
import {
  sendAnthropicMessage,
  type ChatMessage,
} from '@/app/features/developers/playground/anthropicClient';
import {
  executePlaygroundTool,
  PLAYGROUND_TOOLS,
} from '@/app/features/developers/playground/playgroundTools';

jest.mock('@/app/features/developers/playground/anthropicClient', () => ({
  ...jest.requireActual('@/app/features/developers/playground/anthropicClient'),
  sendAnthropicMessage: jest.fn(),
}));

jest.mock('@/app/features/developers/playground/playgroundTools', () => ({
  ...jest.requireActual('@/app/features/developers/playground/playgroundTools'),
  executePlaygroundTool: jest.fn(),
}));

const sendMock = sendAnthropicMessage as jest.Mock;
const executeMock = executePlaygroundTool as jest.Mock;

const config: AgentTurnConfig = {
  anthropicKey: 'sk-ant-fake',
  yosemiteKey: 'yc_test_fake',
  baseUrl: 'http://localhost:8000',
  model: 'claude-sonnet-5',
};

const history: ChatMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'How many upcoming appointments?' }] },
];

beforeEach(() => {
  sendMock.mockReset();
  executeMock.mockReset();
});

describe('runAgentTurn', () => {
  test('returns after a plain text response', async () => {
    sendMock.mockResolvedValue({
      content: [{ type: 'text', text: 'You have 3 upcoming appointments.' }],
      stop_reason: 'end_turn',
    });

    const result = await runAgentTurn(history, config);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const callParams = sendMock.mock.calls[0][0];
    expect(callParams.apiKey).toBe('sk-ant-fake');
    expect(callParams.model).toBe('claude-sonnet-5');
    expect(callParams.tools).toBe(PLAYGROUND_TOOLS);
    expect(callParams.messages[0]).toEqual(history[0]);
    expect(executeMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'You have 3 upcoming appointments.' }],
    });
  });

  test('does not mutate the caller history array', async () => {
    sendMock.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
    });

    await runAgentTurn(history, config);

    expect(history).toHaveLength(1);
  });

  test('executes tool_use blocks and feeds tool_result back before the final answer', async () => {
    sendMock
      .mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Let me check.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_appointments',
            input: { status: 'UPCOMING' },
          },
        ],
        stop_reason: 'tool_use',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'There are 2 upcoming appointments.' }],
        stop_reason: 'end_turn',
      });
    executeMock.mockResolvedValue({ content: '{"data":[{},{}]}', isError: false });

    const progress = jest.fn();
    const result = await runAgentTurn(history, config, progress);

    expect(executeMock).toHaveBeenCalledWith(
      'list_appointments',
      { status: 'UPCOMING' },
      { baseUrl: 'http://localhost:8000', yosemiteKey: 'yc_test_fake' }
    );

    // The tool_result turn must follow the assistant tool_use turn.
    expect(result[1].role).toBe('assistant');
    expect(result[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: '{"data":[{},{}]}',
          is_error: false,
        },
      ],
    });

    expect(result).toHaveLength(4);
    expect(result[3].content).toEqual([
      { type: 'text', text: 'There are 2 upcoming appointments.' },
    ]);
    expect(progress).toHaveBeenCalled();
  });

  test('returns all parallel tool results in a single user message', async () => {
    sendMock
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'toolu_a', name: 'get_organization', input: {} },
          { type: 'tool_use', id: 'toolu_b', name: 'get_usage', input: {} },
        ],
        stop_reason: 'tool_use',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Done.' }],
        stop_reason: 'end_turn',
      });
    executeMock
      .mockResolvedValueOnce({ content: '{"data":{"name":"Clinic"}}', isError: false })
      .mockResolvedValueOnce({ content: 'quota exceeded', isError: true });

    const result = await runAgentTurn(history, config);

    const toolResultTurn = result[2];
    expect(toolResultTurn.role).toBe('user');
    expect(toolResultTurn.content).toHaveLength(2);
    expect(toolResultTurn.content[0]).toMatchObject({ tool_use_id: 'toolu_a', is_error: false });
    expect(toolResultTurn.content[1]).toMatchObject({ tool_use_id: 'toolu_b', is_error: true });
  });

  test('stops when stop_reason is tool_use but no tool_use blocks exist', async () => {
    sendMock.mockResolvedValue({
      content: [{ type: 'text', text: 'odd response' }],
      stop_reason: 'tool_use',
    });

    const result = await runAgentTurn(history, config);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(executeMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  test('caps runaway tool loops at MAX_TOOL_ITERATIONS', async () => {
    sendMock.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'toolu_x', name: 'get_usage', input: {} }],
      stop_reason: 'tool_use',
    });
    executeMock.mockResolvedValue({ content: '{}', isError: false });

    const result = await runAgentTurn(history, config);

    expect(sendMock).toHaveBeenCalledTimes(MAX_TOOL_ITERATIONS);
    const finalMessage = result[result.length - 1];
    expect(finalMessage.role).toBe('assistant');
    expect(finalMessage.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('maximum number of tool calls'),
    });
  });

  test('propagates Anthropic API failures to the caller', async () => {
    sendMock.mockRejectedValue(new Error('Anthropic API error: overloaded'));

    await expect(runAgentTurn(history, config)).rejects.toThrow('overloaded');
  });
});
