const mockRequireWebAuth = jest.fn();
const mockWithOrgPermissions = jest.fn(() => jest.fn());
const mockWithPurchaseOrderOrgPermissions = jest.fn(() => jest.fn());
const mockWithPurchaseOrderDeliveryOrgPermissions = jest.fn(() => jest.fn());
const mockRequirePermission = jest.fn((_permission: string) => jest.fn());
const mockCreateOrder = jest.fn();
const mockListOrders = jest.fn();
const mockGetOutstandingDeliveries = jest.fn();
const mockGetOrder = jest.fn();
const mockConfirmOrder = jest.fn();
const mockReceiveDelivery = jest.fn();
const mockReturnDelivery = jest.fn();
const mockCancelOrder = jest.fn();

jest.mock("src/middlewares/auth", () => ({
  requireWebAuth: mockRequireWebAuth,
}));
jest.mock("src/middlewares/rbac", () => ({
  requirePermission: mockRequirePermission,
  withOrgPermissions: mockWithOrgPermissions,
  withPurchaseOrderOrgPermissions: mockWithPurchaseOrderOrgPermissions,
  withPurchaseOrderDeliveryOrgPermissions:
    mockWithPurchaseOrderDeliveryOrgPermissions,
}));
jest.mock("src/controllers/web/purchase-order.controller", () => ({
  PurchaseOrderController: {
    createOrder: mockCreateOrder,
    listOrders: mockListOrders,
    getOutstandingDeliveries: mockGetOutstandingDeliveries,
    getOrder: mockGetOrder,
    confirmOrder: mockConfirmOrder,
    receiveDelivery: mockReceiveDelivery,
    returnDelivery: mockReturnDelivery,
    cancelOrder: mockCancelOrder,
  },
}));

import router from "src/routers/purchase-order.router";

const routes = () =>
  (
    router.stack as unknown as Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: Array<{ handle: unknown }>;
      };
    }>
  ).flatMap(({ route }) =>
    route
      ? [
          {
            path: route.path,
            methods: route.methods,
            handlers: route.stack.map(
              (entry: { handle: unknown }) => entry.handle,
            ),
          },
        ]
      : [],
  );

describe("purchase order routes", () => {
  it("exposes tenant-scoped list and create routes", () => {
    const list = routes().find(
      (route) =>
        route.path === "/organisation/:organisationId" && route.methods.get,
    );
    const create = routes().find(
      (route) =>
        route.path === "/organisation/:organisationId" && route.methods.post,
    );

    expect(list?.handlers[0]).toBe(mockRequireWebAuth);
    expect(list?.handlers.at(-1)).toBe(mockListOrders);
    expect(create?.handlers[0]).toBe(mockRequireWebAuth);
    expect(create?.handlers.at(-1)).toBe(mockCreateOrder);
    expect(mockWithOrgPermissions).toHaveBeenCalledTimes(3);
  });

  it("derives tenant scope from each order or delivery resource", () => {
    const orderPaths = [
      ["/:purchaseOrderId", "get", mockGetOrder],
      ["/:purchaseOrderId/confirm", "post", mockConfirmOrder],
      ["/:purchaseOrderId/receive-delivery", "post", mockReceiveDelivery],
      ["/:purchaseOrderId/cancel", "post", mockCancelOrder],
    ] as const;
    const allRoutes = routes();

    for (const [path, method, controller] of orderPaths) {
      const route = allRoutes.find(
        (candidate) => candidate.path === path && candidate.methods[method],
      );
      expect(route?.handlers[0]).toBe(mockRequireWebAuth);
      expect(route?.handlers[1]).toBe(
        mockWithPurchaseOrderOrgPermissions.mock.results[
          orderPaths.findIndex(([registeredPath]) => registeredPath === path)
        ]?.value,
      );
      expect(route?.handlers.at(-1)).toBe(controller);
    }

    const returnRoute = allRoutes.find(
      (candidate) => candidate.path === "/deliveries/:deliveryId/return",
    );
    expect(returnRoute?.handlers[1]).toBe(
      mockWithPurchaseOrderDeliveryOrgPermissions.mock.results[0]?.value,
    );
    expect(returnRoute?.handlers.at(-1)).toBe(mockReturnDelivery);
    expect(mockRequirePermission).toHaveBeenCalledTimes(8);
  });

  it("requires separate view and edit permissions", () => {
    expect(
      mockRequirePermission.mock.calls.map(([permission]) => permission),
    ).toEqual([
      "inventory:edit:any",
      "inventory:view:any",
      "inventory:view:any",
      "inventory:view:any",
      "inventory:edit:any",
      "inventory:edit:any",
      "inventory:edit:any",
      "inventory:edit:any",
    ]);
  });
});
