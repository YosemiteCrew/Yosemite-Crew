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
// automatically ONLY while the domain's DNS validation CNAME still resolves; that
// record was missing for the dev subdomain (prod's was present, and prod renewed
// fine), and the only warning was AWS email nobody was watching.
//
// The site kept answering 200 the whole time - an uptime check would have stayed
// green - so this deliberately checks the certificate, not reachability.
//
// It is dependency-free (node:tls only) and makes no AWS API calls: it sees
// exactly what a browser sees, from outside, including the case where a renewed
// certificate exists in ACM but the distribution still serves the old one.
import tls from 'node:tls';
import { argv, exit, stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

// The hostnames a user or an app actually terminates TLS against. Keep the list
// here rather than in the workflow so it is reviewed like code.
const DEFAULT_HOSTS = [
  'yosemitecrew.com',
  'www.yosemitecrew.com',
  'dev.yosemitecrew.com',
  // ds.* fronts the design system, so a lapse there is user-visible even though
  // it is not the marketing site.
  'ds.yosemitecrew.com',
  // NOT listed: app.yosemitecrew.com. Several backend files use it as a
  // hardcoded fallback link (org-usage-notifications.ts, appointment.service.ts,
  // user-organization.service.ts, task.service.ts), but the hostname has no A or
  // CNAME record - it is not deployed. Monitoring it would red this check
  // permanently; the fallbacks themselves are the bug to fix, separately.
  'api.yosemitecrew.com',
  'devapi.yosemitecrew.com',
];

const DEFAULT_WARN_DAYS = 30;
const DEFAULT_FAIL_DAYS = 14;
const CONNECT_TIMEOUT_MS = 15000;

const die = (message) => {
  stderr.write(`${message}\n`);
  exit(2);
};

const parseArgs = (args) => {
  const out = {
    hosts: DEFAULT_HOSTS,
    warnDays: DEFAULT_WARN_DAYS,
    failDays: DEFAULT_FAIL_DAYS,
    json: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--hosts')
      out.hosts = String(args[++i] ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    else if (arg === '--warn-days') out.warnDays = Number(args[++i]);
    else if (arg === '--fail-days') out.failDays = Number(args[++i]);
    else die(`unknown argument: ${arg}`);
  }
  // An empty host list would make Promise.all resolve immediately and the check
  // exit 0 having inspected nothing - a malformed invocation must not look like
  // a pass.
  if (out.hosts.length === 0) die('--hosts requires at least one hostname');
  if (!Number.isFinite(out.warnDays) || !Number.isFinite(out.failDays))
    die('--warn-days and --fail-days must be numbers');
  // Negative thresholds would silently disable the advance notice this check
  // exists to provide: a certificate with hours left would pass unremarked.
  if (out.warnDays < 0 || out.failDays < 0) die('--warn-days and --fail-days must not be negative');
  if (out.failDays > out.warnDays) die('--fail-days must not exceed --warn-days');
  return out;
};

// Certificate validation stays ON. The dates are only needed while a certificate
// is still trusted - that is the whole point, warning BEFORE it lapses - and once
// validation fails the handshake error already names the exact problem
// (CERT_HAS_EXPIRED, ERR_TLS_CERT_ALTNAME_INVALID, ...), which is a hard failure
// either way. So there is never a reason to disable verification to read a
// certificate we have already decided to fail on.
const inspectHost = (host, now) =>
  new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, ALPNProtocols: ['http/1.1'] },
      () => {
        const cert = socket.getPeerCertificate();
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
          // The handshake completed against the real trust store, so this
          // certificate is trusted as of now.
          authorized: true,
          authorizationError: null,
        });
      }
    );
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ host, status: 'error', detail: `timed out after ${CONNECT_TIMEOUT_MS}ms` });
    });
    // err.code carries the precise reason (CERT_HAS_EXPIRED, DEPTH_ZERO_SELF_SIGNED_CERT,
    // ERR_TLS_CERT_ALTNAME_INVALID); keep it, it is the diagnosis.
    socket.on('error', (err) =>
      resolve({ host, status: 'error', detail: err.code ? String(err.code) : err.message })
    );
  });

// A host is a failure when it is untrusted, when it expires inside the fail
// window, or when it could not be inspected at all - an unreachable or
// verification-failing host is a problem, not a pass.
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
  const opts = parseArgs(argv.slice(2));
  const now = new Date();
  const results = evaluate(
    await Promise.all(opts.hosts.map((host) => inspectHost(host, now))),
    opts
  );

  // In --json mode stdout must stay parseable, so the human lines and the
  // GitHub annotations below are suppressed rather than appended to the array.
  if (opts.json) {
    stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const r of results) {
      if (r.status === 'error') {
        stdout.write(`${r.verdict.toUpperCase()}  ${r.host}: ${r.detail}\n`);
        continue;
      }
      stdout.write(
        `${r.verdict.toUpperCase()}  ${r.host}: ${r.daysLeft}d left, expires ${r.validTo}, issuer ${r.issuer}, trusted\n`
      );
    }
    for (const w of results.filter((r) => r.verdict === 'warn')) {
      stdout.write(
        `::warning::${w.host} TLS certificate expires in ${w.daysLeft} days (${w.validTo}) - renew it before it reaches ${opts.failDays} days\n`
      );
    }
    for (const f of results.filter((r) => r.verdict === 'fail' || r.verdict === 'error')) {
      const why = f.status === 'error' ? f.detail : `expires in ${f.daysLeft} days (${f.validTo})`;
      stdout.write(`::error::${f.host} TLS certificate ${why}\n`);
    }
  }

  const failures = results.filter((r) => r.verdict === 'fail' || r.verdict === 'error');
  if (failures.length > 0) {
    stderr.write(
      `\n${failures.length} host(s) failed the TLS expiry check. For an Amplify or ACM domain, renewal needs the domain's DNS validation CNAME to resolve - keep that record in the zone permanently, or every renewal fails silently.\n`
    );
    exit(1);
  }
};

// Only run when invoked directly, so the test can import evaluate(). Compared as
// resolved filesystem paths: import.meta.url percent-encodes characters such as
// spaces while argv[1] does not, so a raw string comparison silently skips main()
// in any clone path containing a space.
const invokedDirectly = () => {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]);
  } catch {
    return false;
  }
};

if (invokedDirectly()) {
  await main();
}
