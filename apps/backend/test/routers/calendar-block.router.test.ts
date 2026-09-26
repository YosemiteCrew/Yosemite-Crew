import { calendarBlockRouter } from "../../src/routers/calendar-block.router";

describe("calendarBlockRouter", () => {
  it("registers read-only listing and permission-gated block changes", () => {
    const routes = calendarBlockRouter.stack
      .map((layer) => layer.route)
      .filter((route): route is NonNullable<typeof route> => Boolean(route));
    expect(routes.map((route) => route.path)).toEqual([
      "/pms/organisation/:organisationId/calendar-blocks",
      "/pms/organisation/:organisationId/calendar-blocks/:blockId",
    ]);
    const firstMethods = (
      routes[0] as unknown as { methods: Record<string, boolean> }
    ).methods;
    const secondMethods = (
      routes[1] as unknown as { methods: Record<string, boolean> }
    ).methods;
    expect(firstMethods).toMatchObject({ get: true, post: true });
    expect(secondMethods).toMatchObject({ patch: true, delete: true });
    expect(routes[0]?.stack).toHaveLength(8);
    expect(routes[1]?.stack).toHaveLength(8);
  });
});
