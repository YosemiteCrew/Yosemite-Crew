import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import type { z } from 'zod';

export interface ToolResultLike {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResultLike>;

export interface RegisteredTool {
  config: {
    description?: string;
    inputSchema?: Record<string, z.ZodTypeAny>;
    annotations?: { readOnlyHint?: boolean };
  };
  handler: ToolHandler;
}

/** Minimal McpServer stand-in that captures registerTool calls. */
export function createServerStub(): { server: McpServer; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  const stub = {
    registerTool: (name: string, config: RegisteredTool['config'], handler: ToolHandler): void => {
      tools.set(name, { config, handler });
    },
  };
  return { server: stub as unknown as McpServer, tools };
}

/** Axios instance stand-in exposing a mock get(). */
export function createClientStub(): { client: AxiosInstance; get: jest.Mock } {
  const get = jest.fn();
  return { client: { get } as unknown as AxiosInstance, get };
}

/** Shape-compatible axios error carrying the contract's error envelope. */
export function axiosError(
  status: number,
  data: unknown,
  headers: Record<string, unknown> = {}
): {
  isAxiosError: true;
  message: string;
  response: { status: number; data: unknown; headers: Record<string, unknown> };
} {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data, headers },
  };
}

/** Axios error with no response (DNS failure, refused connection, timeout). */
export function networkError(message = 'connect ECONNREFUSED 127.0.0.1:3000'): {
  isAxiosError: true;
  message: string;
} {
  return { isAxiosError: true, message };
}

/** Successful axios response wrapper. */
export function okResponse(data: unknown): { data: unknown; status: number } {
  return { data, status: 200 };
}

export const SAMPLE_UUID = '4f2a1c7e-0d3b-4a5e-9c8f-1b2d3e4f5a6b';
