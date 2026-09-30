import { devRoutes } from '@/app/config/routes';
import { DEV_PHONE_MORE_LINKS, DEV_PHONE_TABS } from '@/app/ui/layout/PhoneShell/phoneShellConfig';
import { DEV_ROUTE_GROUPS } from '@/app/ui/layout/Sidebar/Sidebar';

/**
 * A route listed in `devRoutes` is invisible until a navigation surface names it:
 * the sidebar groups are an allow-list of route names, and `groupRoutes()` drops
 * anything a group does not name. So adding a route to `devRoutes` on its own
 * ships a page nobody can reach. Both playground routes hit that, which is why
 * these tests walk `devRoutes` rather than asserting on a fixed list.
 */

const groupedNames = new Set<string>(DEV_ROUTE_GROUPS.flatMap((group) => [...group.routeNames]));
/** `href` is absent on the More tab, which opens a sheet rather than pushing a route. */
const phoneHrefs = new Set<string>(
  DEV_PHONE_TABS.flatMap((tab) => (tab.href ? [tab.href] : []))
    .concat(DEV_PHONE_MORE_LINKS.map((link) => link.href))
);

describe('developer portal navigation coverage', () => {
  it('puts every devRoutes entry in a sidebar group', () => {
    const orphaned = devRoutes.filter((route) => !groupedNames.has(route.name)).map((r) => r.name);

    expect(orphaned).toEqual([]);
  });

  it.each([
    ['API Playground', '/developers/playground'],
    ['MCP Playground', '/developers/mcp'],
  ])('exposes %s from the phone shell', (_name, href) => {
    expect(phoneHrefs.has(href)).toBe(true);
  });

  it('marks both playground routes active under the phone More tab', () => {
    const more = DEV_PHONE_TABS.find((tab) => tab.isMore);

    expect(more?.activePrefixes).toEqual(expect.arrayContaining(['/developers/playground', '/developers/mcp']));
  });
});
