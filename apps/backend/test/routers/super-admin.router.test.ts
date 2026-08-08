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
  },
}));

import superAdminRouter from "src/routers/super-admin.router";

type MockResponse = {
  statusCode: number;
  body: string;
};

const request = async (app: Express, path: string): Promise<MockResponse> => {
  const socket = new PassThrough();
  (socket as PassThrough & { remoteAddress?: string }).remoteAddress =
    "127.0.0.1";
  const requestSocket = socket as unknown as Socket;

  const req = new IncomingMessage(requestSocket);
  req.method = "GET";
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
});
