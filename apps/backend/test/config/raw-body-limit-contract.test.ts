import { describe, expect, it } from "@jest/globals";
import express from "express";
import getRawBody from "raw-body";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";

/**
 * Pins the body-parser contract that keeps AIKIDO-2026-274460 out of reach.
 *
 * raw-body resolves at the patched 4.x floor on every request path. Express 4's
 * body-parser@1.20.6 is CommonJS, so the workspace patch unwraps raw-body's ESM
 * default export until body-parser supports raw-body 4 upstream. The backend
 * images use Node 22, matching raw-body's declared runtime floor.
 *
 * What makes that survivable is not luck. The advisory is that raw-body skips
 * BOTH of its size checks when its `limit` option is null:
 *
 *   var limit = bytes.parse(opts.limit)        // null for anything unparseable
 *   if (limit !== null && length > limit) ...  // both guarded on limit !== null
 *   if (limit !== null && received > limit) ...
 *
 * raw-body 4 rejects invalid values itself, and body-parser also refuses them at
 * configuration time. The direct call below distinguishes an explicit null
 * (the supported opt-out) from an invalid value.
 *
 * These tests exist because that containment is a property of a transitive
 * dependency, invisible to every other test in the suite. Swapping the body
 * parser, or a body-parser release that stops validating the limit, would
 * silently reopen an unbounded-buffering hole while everything else stayed
 * green.
 */
describe("raw-body limit containment", () => {
  const listen = async (app: express.Express) => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return {
      port,
      close: () =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    };
  };

  const postBytes = (port: number, size: number) =>
    new Promise<number>((resolve, reject) => {
      const body = Buffer.alloc(size, 0x61);
      const request = http.request(
        {
          port,
          host: "127.0.0.1",
          path: "/",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": body.length,
          },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode ?? 0));
        },
      );
      request.on("error", reject);
      request.end(body);
    });

  // An explicit null remains the supported way to opt out of a limit.
  it("raw-body buffers without bound when its limit is null", async () => {
    const payload = Buffer.alloc(256 * 1024, 0x61);

    const buffered = await getRawBody(Readable.from([payload]), {
      limit: null,
    });

    expect(buffered.length).toBe(payload.length);
  });

  it("raw-body enforces a limit it can parse", async () => {
    const payload = Buffer.alloc(256 * 1024, 0x61);

    await expect(
      getRawBody(Readable.from([payload]), { limit: 1024 }),
    ).rejects.toMatchObject({ type: "entity.too.large" });
  });

  // Every unparseable limit is refused up front, so the explicit null above
  // cannot be reached accidentally through body-parser configuration.
  const UNPARSEABLE = ["ten mb", "", "not-a-size", "mb"];

  it.each(UNPARSEABLE)(
    "express.json refuses the unparseable limit %p at configuration time",
    (limit) => {
      expect(() => express.json({ limit })).toThrow(TypeError);
    },
  );

  it.each(UNPARSEABLE)(
    "express.raw refuses the unparseable limit %p at configuration time",
    (limit) => {
      expect(() => express.raw({ limit })).toThrow(TypeError);
    },
  );

  it.each(UNPARSEABLE)(
    "express.urlencoded refuses the unparseable limit %p at configuration time",
    (limit) => {
      expect(() => express.urlencoded({ extended: true, limit })).toThrow(
        TypeError,
      );
    },
  );

  // app.ts configures every parser without an explicit limit, so what actually
  // protects the request path is body-parser's own default. Assert it bites.
  it("enforces the default limit when app.ts passes none", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", (_req, res) => {
      res.status(200).end();
    });
    app.use(
      (
        error: { status?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        res.status(error.status ?? 500).end();
      },
    );

    const server = await listen(app);

    try {
      // Comfortably over body-parser's 100kb default.
      await expect(postBytes(server.port, 200 * 1024)).resolves.toBe(413);
    } finally {
      await server.close();
    }
  });

  it("accepts a body under the default limit", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", (_req, res) => {
      res.status(200).end();
    });
    app.use(
      (
        error: { status?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        res.status(error.status ?? 500).end();
      },
    );

    const server = await listen(app);

    try {
      // Well under 100kb, and valid JSON, so it reaches the handler.
      const body = JSON.stringify({ a: "b".repeat(1024) });
      const status = await new Promise<number>((resolve, reject) => {
        const request = http.request(
          {
            port: server.port,
            host: "127.0.0.1",
            path: "/",
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
          },
          (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode ?? 0));
          },
        );
        request.on("error", reject);
        request.end(body);
      });

      expect(status).toBe(200);
    } finally {
      await server.close();
    }
  });
});
