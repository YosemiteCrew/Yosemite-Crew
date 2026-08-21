import { createHash } from 'node:crypto';

import { buildContentSecurityPolicy, PRE_PAINT_SCRIPT_CSP_HASH } from '@/securityHeaders';
import { PRE_PAINT_SCRIPT } from '@/app/ui/theme/prePaintScript';

const sha256Base64 = (input: string) => createHash('sha256').update(input, 'utf8').digest('base64');

describe('pre-paint script CSP hash', () => {
  // The hash lives in securityHeaders.ts and the script in prePaintScript.ts,
  // because securityHeaders must stay import-free: next.config.ts loads it
  // through plain Node, outside webpack's alias resolution, so an `@/` import
  // there breaks the config load. This test is what keeps the two in step -
  // editing the script without updating the hash would silently re-block the
  // theme script, which is the bug this fixed.
  it('matches a freshly computed sha256 of the script it authorises', () => {
    expect(PRE_PAINT_SCRIPT_CSP_HASH).toBe(`'sha256-${sha256Base64(PRE_PAINT_SCRIPT)}'`);
  });

  it('is expressed as a quoted CSP source, not a bare digest', () => {
    expect(PRE_PAINT_SCRIPT_CSP_HASH).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
  });
});

describe('buildContentSecurityPolicy script-src', () => {
  const scriptSrc = (csp: string) =>
    csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src ')) ?? '';

  it('authorises the pre-paint script by hash on the strict CSP', () => {
    const directive = scriptSrc(
      buildContentSecurityPolicy({ nonce: 'abc', allowInlineScripts: false })
    );
    expect(directive).toContain(PRE_PAINT_SCRIPT_CSP_HASH);
    expect(directive).toContain("'nonce-abc'");
  });

  // The regression guard that matters most. Per the CSP spec, a hash or nonce
  // makes the browser IGNORE 'unsafe-inline'. The public marketing pages are
  // statically prerendered and depend on 'unsafe-inline' for their framework
  // inline scripts, so leaking the hash into the permissive variant would break
  // hydration across the whole marketing site while every unit test still passed.
  it('never puts the hash on the permissive CSP, which would disable unsafe-inline', () => {
    const directive = scriptSrc(buildContentSecurityPolicy({ allowInlineScripts: true }));
    expect(directive).toContain("'unsafe-inline'");
    expect(directive).not.toContain(PRE_PAINT_SCRIPT_CSP_HASH);
    expect(directive).not.toContain('sha256-');
  });

  it('does not emit a nonce source on the permissive CSP either', () => {
    const directive = scriptSrc(buildContentSecurityPolicy({ allowInlineScripts: true }));
    expect(directive).not.toContain('nonce-');
  });
});
