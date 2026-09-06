import { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { PassThrough } from "node:stream";
import express, { type Express } from "express";

const mockGetAuthService = jest.fn();
const mockGetSession = jest.fn();
const mockCreateSessionMiddleware = jest.fn((options = {}) => {
  return async (
    req: never,
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const service = mockGetAuthService();

    let session: { appUserId: string; authProfile?: string } | null = null;
    if (service) {
      session = await service.getSession({ req, res });
    }

    if (!session) {
      if (options && (options as { optional?: boolean }).optional) {
        next();
        return;
      }

      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (
      (options as { profile?: string }).profile &&
      session.authProfile !== (options as { profile?: string }).profile
    ) {
      if (options && (options as { optional?: boolean }).optional) {
        next();
        return;
      }

      res.status(403).json({ message: "Session not valid for this resource" });
      return;
    }

    (
      req as { authSession?: { appUserId: string; authProfile?: string } }
    ).authSession = session;
    next();
  };
});
const mockListBusinesses = jest.fn((_, res) =>
  res.status(200).json({ businesses: [{ id: "org-1" }] }),
);
const mockGetBusiness = jest.fn();
const mockUpdateBusiness = jest.fn();
const mockListMembers = jest.fn((_, res) =>
  res.status(200).json({ members: [{ userId: "user-1", roleCode: "doctor" }] }),
);
const mockListQuarantine = jest.fn((_, res) =>
  res.status(200).json({ total: 0, returned: 0, results: [] }),
);
const mockResolveQuarantine = jest.fn((_, res) =>
  res.status(200).json({ resolved: true }),
);

jest.mock("@yosemite-crew/auth", () => ({
  createSessionMiddleware: mockCreateSessionMiddleware,
  getAuthService: mockGetAuthService,
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("src/controllers/web/super-admin-business.controller", () => ({
  SuperAdminBusinessController: {
    listBusinesses: mockListBusinesses,
    getBusiness: mockGetBusiness,
    updateBusiness: mockUpdateBusiness,
    listMembers: mockListMembers,
  },
}));

jest.mock("src/controllers/web/super-admin-lab-ingestion.controller", () => ({
  SuperAdminLabIngestionController: {
    listQuarantine: mockListQuarantine,
    resolveQuarantine: mockResolveQuarantine,
  },
}));

import superAdminRouter from "src/routers/super-admin.router";

type MockResponse = {
  statusCode: number;
  body: string;
};

const request = async (
  app: Express,
  path: string,
  method = "GET",
): Promise<MockResponse> => {
  const socket = new PassThrough();
  (socket as PassThrough & { remoteAddress?: string }).remoteAddress =
    "127.0.0.1";
  const requestSocket = socket as unknown as Socket;

  const req = new IncomingMessage(requestSocket);
  req.method = method;
  req.url = path;
  req.headers = {};
  req.socket = requestSocket;
  req.connection = requestSocket;

  const res = new ServerResponse(req);
  res.assignSocket(requestSocket);

  const rawChunks: Buffer[] = [];
  socket.on("data", (chunk) => {
    rawChunks.push(Buffer.from(chunk));
  });

  await new Promise<void>((resolve) => {
    res.on("finish", resolve);
    (
      app as unknown as {
        handle: (request: IncomingMessage, response: ServerResponse) => void;
      }
    ).handle(req, res);
  });

  const raw = Buffer.concat(rawChunks).toString("utf8");
  const body = raw.includes("\r\n\r\n")
    ? raw.slice(raw.indexOf("\r\n\r\n") + 4)
    : raw;

  return {
    statusCode: res.statusCode,
    body,
  };
};

const createApp = (
  session?: {
    appUserId: string;
    providerUserId?: string;
    authProfile?: "pims_web" | "pet_parent_mobile";
    roles?: string[];
  },
  authServiceEnabled = true,
  roles: string[] = ["superadmin"],
) => {
  const app = express();

  mockGetSession.mockResolvedValue(session ?? null);
  mockGetAuthService.mockReturnValue(
    authServiceEnabled
      ? {
          getSession: mockGetSession,
          getUserRoles: jest.fn().mockResolvedValue(roles),
        }
      : null,
  );

  app.use("/v1/super-admin", superAdminRouter);
  return app;
};

describe("super-admin router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects requests when the auth service is unavailable", async () => {
    const response = await request(
      createApp({ appUserId: "user-1" }, false),
      "/v1/super-admin/businesses",
    );

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      message: "Authentication required",
    });
  });

  it("rejects requests without an attached session", async () => {
    const response = await request(createApp(), "/v1/super-admin/businesses");

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      message: "Authentication required",
    });
  });

  it("rejects users without the superadmin role", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["member"],
        },
        true,
        [],
      ),
      "/v1/super-admin/businesses",
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      message: "Forbidden",
    });
    expect(mockListBusinesses).not.toHaveBeenCalled();
  });

  it("allows superadmin users to access the endpoints", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pet_parent_mobile",
          roles: ["superadmin"],
        },
        true,
        [],
      ),
      "/v1/super-admin/businesses",
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      businesses: [{ id: "org-1" }],
    });
    expect(mockListBusinesses).toHaveBeenCalledTimes(1);
  });

  // The guard is `router.use(...)` above every route, so a new route inherits it - but
  // "inherits it" is the kind of thing that is true until someone mounts a route above the
  // use(). The quarantine list is cross-tenant lab data, so it is asserted rather than
  // assumed.
  it("rejects a non-superadmin on the lab ingestion quarantine list", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["member"],
        },
        true,
        [],
      ),
      "/v1/super-admin/lab-ingestion/quarantine",
    );

    expect(response.statusCode).toBe(403);
    expect(mockListQuarantine).not.toHaveBeenCalled();
  });

  it("serves the lab ingestion quarantine list to a superadmin", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["superadmin"],
        },
        true,
        [],
      ),
      "/v1/super-admin/lab-ingestion/quarantine",
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      total: 0,
      returned: 0,
      results: [],
    });
    expect(mockListQuarantine).toHaveBeenCalledTimes(1);
  });

  // Resolving is the only write on this surface and it clears a row out of the
  // operator's severity count, so the guard on it is asserted separately rather
  // than inferred from the read above.
  it("rejects a non-superadmin resolving a quarantined result", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["member"],
        },
        true,
        [],
      ),
      "/v1/super-admin/lab-ingestion/quarantine/q-1/resolve",
      "PATCH",
    );

    expect(response.statusCode).toBe(403);
    expect(mockResolveQuarantine).not.toHaveBeenCalled();
  });

  it("lets a superadmin resolve a quarantined result", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["superadmin"],
        },
        true,
        [],
      ),
      "/v1/super-admin/lab-ingestion/quarantine/q-1/resolve",
      "PATCH",
    );

    expect(response.statusCode).toBe(200);
    expect(mockResolveQuarantine).toHaveBeenCalledTimes(1);
  });
  // The members list names the individual accounts behind a clinic, so it is
  // guarded in its own right rather than by inheriting the router's other tests.
  it("rejects a non-superadmin listing an organisation's members", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["member"],
        },
        true,
        [],
      ),
      "/v1/super-admin/businesses/org-1/members",
    );

    expect(response.statusCode).toBe(403);
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  it("serves an organisation's members to a superadmin", async () => {
    const response = await request(
      createApp(
        {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          authProfile: "pims_web",
          roles: ["superadmin"],
        },
        true,
        [],
      ),
      "/v1/super-admin/businesses/org-1/members",
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      members: [{ userId: "user-1", roleCode: "doctor" }],
    });
    expect(mockListMembers).toHaveBeenCalledTimes(1);
  });
});
