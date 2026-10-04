import { createRequire } from 'node:module';

let loadModule = createRequire(require.resolve('electron-builder/package.json'));
for (const name of ['app-builder-lib', '@electron/get', 'got', 'cacheable-request']) {
  loadModule = createRequire(loadModule.resolve(`${name}/package.json`));
}
const CachePolicy = loadModule('http-cache-semantics');
const url = 'https://example.test/resource';

describe('cached response revalidation', () => {
  test.each([
    ['private', { 'cache-control': 'private, max-age=60' }],
    ['no-store', { 'cache-control': 'no-store, max-age=60' }],
    ['no-cache', { 'cache-control': 'no-cache, max-age=60' }],
    ['cookies', { 'cache-control': 'max-age=60', 'set-cookie': 'example=value' }],
    ['vary', { 'cache-control': 'max-age=60', vary: '*' }],
    ['zero freshness', { 'cache-control': 'max-age=0' }],
  ])('revalidates %s responses even when stale reuse is requested', (_name, headers) => {
    const policy = new CachePolicy({ url, method: 'GET', headers: {} }, { status: 200, headers });
    expect(
      policy.satisfiesWithoutRevalidation({
        url,
        method: 'GET',
        headers: { 'cache-control': 'max-stale=3600' },
      })
    ).toBe(false);
  });

  test('reuses an ordinary fresh response', () => {
    const policy = new CachePolicy(
      { url, method: 'GET', headers: {} },
      { status: 200, headers: { 'cache-control': 'public, max-age=60' } }
    );
    expect(policy.satisfiesWithoutRevalidation({ url, method: 'GET', headers: {} })).toBe(true);
  });

  test('reuses an ordinary expired response within the requested stale period', () => {
    const policy = new CachePolicy(
      { url, method: 'GET', headers: {} },
      { status: 200, headers: { 'cache-control': 'public, max-age=60', age: '120' } }
    );
    expect(
      policy.satisfiesWithoutRevalidation({
        url,
        method: 'GET',
        headers: { 'cache-control': 'max-stale=120' },
      })
    ).toBe(true);
  });
});
