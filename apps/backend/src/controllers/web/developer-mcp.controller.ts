import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ApiKeyRequest } from "src/middlewares/api-key-auth";
import { DeveloperMcpService } from "src/services/developer-mcp.service";
import logger from "src/utils/logger";

// Remote MCP endpoint (data plane, POST /v1/developer/mcp). Stateless
// Streamable HTTP per the SDK docs: a fresh McpServer + transport pair is
// built for every request (sessionIdGenerator: undefined), handles exactly
// one JSON-RPC message, and is torn down when the response closes. No session
// state can leak between requests or tenants. enableJsonResponse keeps the
// reply a plain JSON body - no SSE stream is ever opened on this endpoint.

export const DeveloperMcpController = {
  handlePost: async (req: Request, res: Response): Promise<void> => {
    const apiKey = (req as ApiKeyRequest).apiKey;
    if (!apiKey) {
      // authorizeApiKey always runs first; this is a wiring failure, not auth.
      res
        .status(500)
        .json({ message: "Internal server error", code: "internal_error" });
      return;
    }

    const server = DeveloperMcpService.buildServer({
      organisationId: apiKey.organisationId,
      scopes: apiKey.scopes,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("DeveloperMcp request failed", { error });
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Internal server error", code: "internal_error" });
      }
    }
  },

  // Stateless mode has no server-initiated stream to GET and no session to
  // DELETE (SDK streamableHttp docs) - both are 405 with a JSON-RPC error
  // body, mirroring the SDK's stateless example.
  methodNotAllowed: (_req: Request, res: Response): void => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
  },
};
