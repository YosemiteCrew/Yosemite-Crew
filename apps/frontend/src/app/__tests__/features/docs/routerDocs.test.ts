import fs from 'fs';
import path from 'path';

const ROUTERS_DIR = path.join(process.cwd(), '..', 'backend', 'src', 'routers');
const ROUTER_DOCS_DIR = path.join(process.cwd(), 'content', 'docs', 'apps', 'backend', 'routers');

describe('docs backend router coverage (#2943)', () => {
  const listRouters = (dir: string): string[] =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.router.ts') || f.endsWith('.routes.ts'))
      .map((f) => f.replace(/\.(router|routes)\.ts$/, '')) // observationTool.routes.ts -> observationTool
      .sort();

  // Sanity on the fixture itself so a typo in the path above silently stops
  // guarding nothing.
  const routers = listRouters(ROUTERS_DIR);
  it('still finds the routers directory', () => {
    expect(routers.length).toBeGreaterThan(36);
  });

  it('every router file has a doc page', () => {
    const docs = fs
      .readdirSync(ROUTER_DOCS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    const missing = routers.filter((name) => !docs.includes(name));
    expect(missing).toEqual([]);
  });
});
