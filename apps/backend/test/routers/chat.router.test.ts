import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());

const ChatController = {
  generateToken: jest.fn(),
  generateTokenForPMS: jest.fn(),
  ensureAppointmentSession: jest.fn(),
  openChat: jest.fn(),
  listMySessions: jest.fn(),
  createOrgDirectChat: jest.fn(),
  createOrgGroupChat: jest.fn(),
  closeSession: jest.fn(),
  addGroupMembers: jest.fn(),
  removeGroupMembers: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  shareEntityToChannel: jest.fn(),
  listSharedEntities: jest.fn(),
  revokeSharedEntity: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/controllers/app/chat.controller", () => ({
  ChatController,
}));

const chatRouter = jest.requireActual("../../src/routers/chat.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) =>
  ((chatRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("chat.router shared-entity routes", () => {
  it("registers POST /pms/share behind cognito auth", () => {
    const route = findRoute("/pms/share", "post");
    expect(route).toBeDefined();
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
  });

  it("registers GET /pms/share/:channelId behind cognito auth", () => {
    const route = findRoute("/pms/share/:channelId", "get");
    expect(route).toBeDefined();
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
  });

  it("registers POST /pms/share/:id/revoke behind cognito auth", () => {
    const route = findRoute("/pms/share/:id/revoke", "post");
    expect(route).toBeDefined();
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
  });
});
