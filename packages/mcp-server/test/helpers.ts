import type { AxiosInstance } from 'axios';

export type RecordedCall = { url: string; config?: Record<string, unknown> };

/**
 * A stand-in for the axios instance that records what each tool asked for.
 * The assertions that matter are the URL and the x-org-id header, so those are
 * what this captures.
 */
export function fakeClient(
  impl: (url: string, config?: Record<string, unknown>) => Promise<unknown> = async () => ({
    data: { ok: true },
  })
) {
  const calls: RecordedCall[] = [];
  const client = {
    get: (url: string, config?: Record<string, unknown>) => {
      calls.push({ url, config });
      return impl(url, config);
    },
  } as unknown as AxiosInstance;
  return { client, calls };
}

export type RegisteredTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (
    args: Record<string, never>
  ) => Promise<{ isError?: boolean; content: { text: string }[] }>;
};

/** Captures tool registrations instead of speaking MCP over a transport. */
export function fakeServer() {
  const tools: RegisteredTool[] = [];
  const server = {
    tool: (
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: RegisteredTool['handler']
    ) => {
      tools.push({ name, description, schema, handler });
    },
  };
  return { server: server as never, tools };
}

export const axiosFailure = (status: number, data?: unknown) => ({
  isAxiosError: true as const,
  message: `Request failed with status code ${status}`,
  response: { status, data },
});
