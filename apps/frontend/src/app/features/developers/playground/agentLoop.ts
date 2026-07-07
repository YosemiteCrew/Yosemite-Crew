/**
 * Tool-use loop for the Agent Playground.
 *
 * Runs a single conversational turn: sends the history to the Anthropic
 * Messages API, executes any requested read-only tools against the Developer
 * Data API, feeds the results back as tool_result blocks, and repeats until
 * the model produces a final answer or the iteration cap is reached.
 */
import {
  sendAnthropicMessage,
  type ChatMessage,
  type ToolUseBlock,
} from '@/app/features/developers/playground/anthropicClient';
import {
  executePlaygroundTool,
  PLAYGROUND_TOOLS,
} from '@/app/features/developers/playground/playgroundTools';

export const MAX_TOOL_ITERATIONS = 8;

export type AgentTurnConfig = {
  anthropicKey: string;
  yosemiteKey: string;
  baseUrl: string;
  model: string;
};

export type AgentTurnProgress = (messages: ChatMessage[]) => void;

/**
 * Runs one agent turn and returns the full updated message history.
 * Anthropic API failures propagate as AnthropicRequestError; tool failures
 * are fed back to the model as error tool results instead of throwing.
 */
export const runAgentTurn = async (
  history: ChatMessage[],
  config: AgentTurnConfig,
  onProgress?: AgentTurnProgress
): Promise<ChatMessage[]> => {
  const messages: ChatMessage[] = [...history];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await sendAnthropicMessage({
      apiKey: config.anthropicKey,
      model: config.model,
      messages,
      tools: PLAYGROUND_TOOLS,
    });

    messages.push({ role: 'assistant', content: response.content });
    onProgress?.([...messages]);

    if (response.stop_reason !== 'tool_use') return messages;

    const toolUses = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );
    if (toolUses.length === 0) return messages;

    const results = await Promise.all(
      toolUses.map(async (block) => {
        const result = await executePlaygroundTool(block.name, block.input, {
          baseUrl: config.baseUrl,
          yosemiteKey: config.yosemiteKey,
        });
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result.content,
          is_error: result.isError,
        };
      })
    );

    messages.push({ role: 'user', content: results });
    onProgress?.([...messages]);
  }

  messages.push({
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Stopped after reaching the maximum number of tool calls for a single turn. Ask a follow-up question to continue.',
      },
    ],
  });
  onProgress?.([...messages]);
  return messages;
};
