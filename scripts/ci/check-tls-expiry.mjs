#!/usr/bin/env node
// Fail before a public TLS certificate expires, instead of after.
//
// Usage:
//   node scripts/ci/check-tls-expiry.mjs
//   node scripts/ci/check-tls-expiry.mjs --warn-days 30 --fail-days 14
//   node scripts/ci/check-tls-expiry.mjs --hosts dev.yosemitecrew.com,api.yosemitecrew.com
//   node scripts/ci/check-tls-expiry.mjs --json
//
// Why this exists:
//
// dev.yosemitecrew.com went "not secure" for every visitor on 2026-08-13 because
// its Amplify-managed ACM certificate expired at 2026-08-12 23:59:59Z. ACM renews
// automatically ONLY while the domain's DNS validation CNAME still resolves; this
// zone is hosted away from Route 53, the record was not there at renewal time, and
// the only warning was AWS email nobody was watching. Nothing in CI knew, so the
// first signal was a user hitting a browser interstitial.
//
// The site kept answering 200 the whole time - an uptime check would have stayed
// green - so this deliberately checks the certificate, not reachability.
//
// It is intentionally dependency-free (node:tls only) and makes no AWS API calls:
// it sees exactly what a browser sees, from outside, including the case where a
// renewed certificate exists in ACM but the distribution still serves the old one.
import tls from 'node:tls';

// The hostnames a user or an app actually terminates TLS against. Keep the list
// here rather than in the workflow so it is reviewed like code.
const DEFAULT_HOSTS = [
  'yosemitecrew.com',
  'www.yosemitecrew.com',
  'dev.yosemitecrew.com',
  'api.yosemitecrew.com',
  'devapi.yosemitecrew.com',
];

const DEFAULT_WARN_DAYS = 30;
const DEFAULT_FAIL_DAYS = 14;
const CONNECT_TIMEOUT_MS = 15000;

const parseArgs = (argv) => {
  const out = {
    hosts: DEFAULT_HOSTS,
    warnDays: DEFAULT_WARN_DAYS,
    failDays: DEFAULT_FAIL_DAYS,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--hosts')
      out.hosts = String(argv[++i] ?? '')
        .split(',')
        .filter(Boolean);
    else if (arg === '--warn-days') out.warnDays = Number(argv[++i]);
    else if (arg === '--fail-days') out.failDays = Number(argv[++i]);
    else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(out.warnDays) || !Number.isFinite(out.failDays)) {
    process.stderr.write('--warn-days and --fail-days must be numbers\n');
    process.exit(2);
  }
  if (out.failDays > out.warnDays) {
    process.stderr.write('--fail-days must not exceed --warn-days\n');
    process.exit(2);
  }
  return out;
};

// rejectUnauthorized stays false so an ALREADY-expired or mismatched certificate
// is still readable: that is precisely the state this check must report on, and a
// verifying handshake would abort before handing over the certificate. The
// verification result is captured separately below instead of being discarded.
const inspectHost = (host, now) =>
  new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'] },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const authorizationError = socket.authorizationError
          ? String(socket.authorizationError)
          : null;
        socket.end();
        if (!cert || !cert.valid_to) {
          resolve({ host, status: 'error', detail: 'no certificate presented' });
          return;
        }
        const validTo = new Date(cert.valid_to);
        const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86400000);
        const names = (cert.subjectaltname ?? '')
          .split(',')
          .map((n) => n.trim().replace(/^DNS:/, ''))
          .filter(Boolean);
        resolve({
          host,
          status: 'ok',
          validTo: validTo.toISOString(),
          daysLeft,
          issuer: cert.issuer?.O ?? cert.issuer?.CN ?? 'unknown',
          names,
          authorized,
          authorizationError,
        });
      }
    );
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ host, status: 'error', detail: `timed out after ${CONNECT_TIMEOUT_MS}ms` });
    });
    socket.on('error', (err) => resolve({ host, status: 'error', detail: err.message }));
  });

// A host is a failure when it is already untrusted by a real trust store, when it
// expires inside the fail window, or when it could not be inspected at all - an
// unreachable host is unknown, not fine.
const classify = (result, opts) => {
  if (result.status === 'error') return 'error';
  if (!result.authorized) return 'fail';
  if (result.daysLeft <= opts.failDays) return 'fail';
  if (result.daysLeft <= opts.warnDays) return 'warn';
  return 'pass';
};

export const evaluate = (results, opts) =>
  results.map((result) => ({ ...result, verdict: classify(result, opts) }));

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const now = new Date();
  const results = evaluate(
    await Promise.all(opts.hosts.map((host) => inspectHost(host, now))),
    opts
  );

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const r of results) {
      if (r.status === 'error') {
        process.stdout.write(`${r.verdict.toUpperCase()}  ${r.host}: ${r.detail}\n`);
        continue;
      }
      const trust = r.authorized ? 'trusted' : `UNTRUSTED (${r.authorizationError})`;
      process.stdout.write(
        `${r.verdict.toUpperCase()}  ${r.host}: ${r.daysLeft}d left, expires ${r.validTo}, issuer ${r.issuer}, ${trust}\n`
      );
    }
  }

  const failures = results.filter((r) => r.verdict === 'fail' || r.verdict === 'error');
  const warnings = results.filter((r) => r.verdict === 'warn');
  for (const w of warnings) {
    process.stdout.write(
      `::warning::${w.host} TLS certificate expires in ${w.daysLeft} days (${w.validTo}) - renew it before it reaches ${opts.failDays} days\n`
    );
  }
  for (const f of failures) {
    const why =
      f.status === 'error'
        ? f.detail
        : f.authorized
          ? `expires in ${f.daysLeft} days (${f.validTo})`
          : `not trusted: ${f.authorizationError}`;
    process.stdout.write(`::error::${f.host} TLS certificate ${why}\n`);
  }
  if (failures.length > 0) {
    process.stderr.write(
      `\n${failures.length} host(s) failed the TLS expiry check. For an Amplify or ACM domain, renewal needs the domain's DNS validation CNAME to resolve - keep that record in the zone permanently, or every renewal fails silently.\n`
    );
    process.exit(1);
  }
};

// Only run when invoked directly, so the test can import evaluate().
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
