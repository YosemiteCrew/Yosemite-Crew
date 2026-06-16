import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withInventoryItemOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const InventoryController = {
  createItem: jest.fn(),
  updateItem: jest.fn(),
  hideItem: jest.fn(),
  archiveItem: jest.fn(),
  activeItem: jest.fn(),
  toggleItemStatus: jest.fn(),
  listItems: jest.fn(),
  getInventoryTurnOver: jest.fn(),
  getItemWithBatches: jest.fn(),
  getCategories: jest.fn(),
  addBatch: jest.fn(),
  updateBatch: jest.fn(),
  deleteBatch: jest.fn(),
  consumeStock: jest.fn(),
  bulkConsumeStock: jest.fn(),
  adjustStock: jest.fn(),
  allocateStock: jest.fn(),
  releaseAllocatedStock: jest.fn(),
};

const InventoryVendorController = {
  createVendor: jest.fn(),
  listVendors: jest.fn(),
  getVendor: jest.fn(),
  updateVendor: jest.fn(),
  deleteVendor: jest.fn(),
};

const InventoryMetaFieldController = {
  createField: jest.fn(),
  listFields: jest.fn(),
  updateField: jest.fn(),
  deleteField: jest.fn(),
};

const InventoryAlertController = {
  getLowStockItems: jest.fn(),
  getExpiringItems: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withInventoryItemOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/inventory.controller", () => ({
  InventoryController,
  InventoryVendorController,
  InventoryMetaFieldController,
  InventoryAlertController,
}));

const inventoryRouter = jest.requireActual("../../src/routers/inventory.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (inventoryRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("inventory.router", () => {
  it("protects org-scoped inventory list routes with org RBAC", () => {
    const listItemsRoute = findRoute(
      "/organisation/:organisationId/items",
      "get",
    );
    const turnoverRoute = findRoute(
      "/organisation/:organisationId/turnover",
      "get",
    );

    expect(listItemsRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(turnoverRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(withOrgPermissions).toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("inventory:view:any");
  });

  it("protects item-by-id inventory routes with derived item org RBAC", () => {
    const detailRoute = findRoute("/items/:itemId", "get");
    const updateRoute = findRoute("/items/:itemId", "patch");
    const hideRoute = findRoute("/items/:itemId/hide", "post");
    const archiveRoute = findRoute("/items/:itemId/archive", "post");
    const activeRoute = findRoute("/items/:itemId/active", "post");
    const statusRoute = findRoute("/items/:itemId/status", "patch");

    expect(detailRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(updateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(hideRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(archiveRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(activeRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(statusRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );

    expect(withInventoryItemOrgPermissions).toHaveBeenCalledTimes(6);
    expect(requirePermission).toHaveBeenCalledWith("inventory:view:any");
    expect(requirePermission).toHaveBeenCalledWith("inventory:edit:any");
  });
});
