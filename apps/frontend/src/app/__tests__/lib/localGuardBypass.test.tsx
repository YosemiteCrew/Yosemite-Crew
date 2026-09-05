import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';

import { isLocalGuardBypassEnabled, useLocalGuardBypass } from '@/app/lib/localGuardBypass';

describe('isLocalGuardBypassEnabled', () => {
  const originalFlag = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const originalHostname = process.env.YC_TEST_HOSTNAME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalFlag;
    process.env.YC_TEST_HOSTNAME = originalHostname;
  });

  it('is off when the flag is unset, whatever the host', () => {
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    process.env.YC_TEST_HOSTNAME = 'localhost';
    expect(isLocalGuardBypassEnabled()).toBe(false);
  });

  it.each(['localhost', 'LOCALHOST', '127.0.0.1'])('is on for %s', (hostname) => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = hostname;
    expect(isLocalGuardBypassEnabled()).toBe(true);
  });

  // The flag is NEXT_PUBLIC_, so its value ships inside the client bundle. A
  // build that sets it by mistake must not be able to render the private shell
  // on a deployed host.
  it.each(['app.example.com', 'staging.example.com', 'localhost.evil.test'])(
    'stays off for %s even with the flag set',
    (hostname) => {
      process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
      process.env.YC_TEST_HOSTNAME = hostname;
      expect(isLocalGuardBypassEnabled()).toBe(false);
    }
  );
});

/**
 * The hook exists because the plain function cannot be called during render.
 *
 * The flag is baked into the bundle but the hostname is a browser-only read, so
 * the server resolves the bypass to `false` and a local client resolves it to
 * `true`. Four components branch on that, and the difference reached the DOM:
 * the server sent the sidebar's `<div class="sidebar">` placeholder while the
 * client rendered the whole shell, so every local page load threw the server
 * HTML away with a hydration mismatch. Verified in a browser 2026-09-04: the
 * error on /guides and /dashboard, and gone after this change.
 *
 * These tests server-render and then hydrate, which is the only way to catch it
 * - a client-only render agrees with itself no matter which form is used.
 */
describe('useLocalGuardBypass', () => {
  const originalFlag = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const originalHostname = process.env.YC_TEST_HOSTNAME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalFlag;
    process.env.YC_TEST_HOSTNAME = originalHostname;
    jest.restoreAllMocks();
  });

  // Mirrors Sidebar.tsx: a placeholder while the guard is on, the shell once the
  // bypass applies. Whichever way round, the two renders must agree.
  const Shell = () => {
    const bypassed = useLocalGuardBypass();
    return bypassed ? <main>shell</main> : <div className="placeholder" />;
  };

  const renderThenHydrate = async () => {
    const html = renderToString(<Shell />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors: string[] = [];
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.map(String).join(' '));
    });

    await act(async () => {
      hydrateRoot(container, <Shell />);
    });

    return { serverHtml: html, container, errors };
  };

  it('hydrates without a mismatch on a local origin with the bypass on', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = 'localhost';

    const { serverHtml, container, errors } = await renderThenHydrate();

    // The server renders the guarded branch, because it has no hostname to check.
    expect(serverHtml).toContain('placeholder');
    // React then swaps in the bypassed branch, without discarding the server HTML.
    expect(container.querySelector('main')?.textContent).toBe('shell');
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  it('hydrates without a mismatch when the bypass is off', async () => {
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    process.env.YC_TEST_HOSTNAME = 'localhost';

    const { serverHtml, container, errors } = await renderThenHydrate();

    // Production shape: both sides agree already, and nothing swaps.
    expect(serverHtml).toContain('placeholder');
    expect(container.querySelector('main')).toBeNull();
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  it('keeps the deployed-host protection', () => {
    // The deferral must not become a way in: the safe value is what the server
    // and the hydration pass both use, and a non-local host never leaves it.
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = 'app.example.com';

    expect(renderToString(<Shell />)).toContain('placeholder');
  });
});

/**
 * The docstring on `isLocalGuardBypassEnabled` already tells callers to route
 * through the helper, and it records what happened anyway: "the session
 * initializer and the sidebar ended up rendering the private shell on a deployed
 * host while their comments claimed they could not". The render-safety rule is
 * the same shape of instruction, so it is checked here instead of described.
 */
describe('the render-time form', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
      return entry.isFile() && full.endsWith('.tsx') && !full.endsWith('.stories.tsx')
        ? [full]
        : [];
    });

  it('is what components import, not the plain function', () => {
    const root = join(__dirname, '..', '..');
    const offenders = walk(root).filter((file) =>
      /\bisLocalGuardBypassEnabled\b/.test(readFileSync(file, 'utf8'))
    );

    // A component branching on the bypass during render must call
    // useLocalGuardBypass, which gives the server and the hydration pass the same
    // answer. The plain function reads window.location and diverges.
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
