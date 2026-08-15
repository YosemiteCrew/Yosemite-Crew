import { createRequire } from "node:module";
import path from "node:path";
import semver from "semver";

import backendPackage from "../../package.json";

/**
 * bullmq 6 dropped ioredis from a direct dependency to an OPTIONAL peer, and
 * pnpm's auto-install-peers does not install optional peers. That silently
 * removed the Redis driver from the lockfile, and because the backend passes a
 * plain `{ host, port, password }` object as `connection` rather than a client
 * instance, bullmq has to `require('ioredis')` itself at runtime. Without it
 * every queue operation rejects with "BullMQ could not load the optional
 * 'ioredis' package", initQueues rejects, and main.ts exits before the server
 * listens - a whole-backend outage.
 *
 * The scheduler suites cannot catch that: they jest.mock every queue module, so
 * no real Queue is ever constructed and no driver is ever loaded. These
 * assertions deliberately avoid mocks and check the dependency graph itself.
 */
describe("bullmq redis driver", () => {
  const requireFromBackend = createRequire(
    path.join(__dirname, "../../package.json"),
  );

  it("is declared as a direct dependency, not left to an optional peer", () => {
    const deps = backendPackage.dependencies as Record<string, string>;
    expect(deps.ioredis).toBeDefined();
  });

  it("is actually installed and loadable", () => {
    expect(() => requireFromBackend.resolve("ioredis")).not.toThrow();

    const ioredis = requireFromBackend("ioredis");
    expect(typeof (ioredis.default ?? ioredis)).toBe("function");
  });

  it("satisfies the range bullmq asks for", () => {
    const bullmq = requireFromBackend("bullmq/package.json");
    const range = bullmq.peerDependencies?.ioredis;
    expect(range).toBeDefined();

    const installed = requireFromBackend("ioredis/package.json").version;
    expect(semver.satisfies(installed, range)).toBe(true);
  });

  // If the connection is ever changed to a client instance or a clientFactory,
  // bullmq stops needing to load the driver itself and this file can go. Until
  // then the plain-object form is what makes the dependency mandatory.
  it("still connects with a plain options object, which is what forces the driver", async () => {
    const { redisConnection } = await import("../../src/queues/bull.config");

    expect(redisConnection).toEqual(
      expect.objectContaining({ host: expect.any(String) }),
    );
    expect(typeof redisConnection).toBe("object");
  });
});
