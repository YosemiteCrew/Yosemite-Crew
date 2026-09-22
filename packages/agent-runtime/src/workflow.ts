import { AgentRuntimeError } from './errors.js';
import type { RunContext, SourceReference, ToolSchema } from './types.js';

export interface ToolResult {
  readonly data: unknown;
  readonly sources: readonly SourceReference[];
}

// Product-owned data access. A model never reaches the database; it reaches
// this, and only through the runtime's permission check.
export type ToolHandler = (
  input: Readonly<Record<string, unknown>>,
  ctx: RunContext
) => Promise<ToolResult>;

export interface WorkflowDefinition<TResult> {
  readonly id: string;
  readonly instructions: string;
  readonly tools: readonly ToolSchema[];
  // The product decides what a valid result is. A provider that returns
  // something else fails the run rather than widening the contract.
  validateResult(output: unknown): TResult;
  // Re-read on resume so a restarted run compares against current record
  // versions instead of trusting what a transcript remembered.
  refreshSources(
    input: Readonly<Record<string, unknown>>,
    ctx: RunContext
  ): Promise<readonly SourceReference[]>;
}

export const malformed = (detail: string): AgentRuntimeError =>
  new AgentRuntimeError('malformed-output', `Provider output rejected: ${detail}`);
