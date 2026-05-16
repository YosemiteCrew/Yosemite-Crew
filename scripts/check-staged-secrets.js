#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const PROTECTED_ROOTS = ['apps/mobileAppYC/', 'apps/frontend/'];
const BLOCKED_LOCAL_FILES = [
  /^apps\/frontend\/\.env(?:$|\.local$|\.(?!example$).+)/,
  /^apps\/mobileAppYC\/android\/app\/google-services\.json$/,
  /^apps\/mobileAppYC\/android\/app\/src\/main\/res\/values\/strings\.xml$/,
  /^apps\/mobileAppYC\/android\/gradle\.properties$/,
  /^apps\/mobileAppYC\/android\/local\.properties$/,
  /^apps\/mobileAppYC\/ios\/GoogleService-Info\.plist$/,
  /^apps\/mobileAppYC\/ios\/mobileAppYC\/Info\.plist$/,
  /^apps\/mobileAppYC\/ios\/\.xcode\.env\.local$/,
  /^apps\/mobileAppYC\/src\/config\/variables\.local\.tsx?$/,
];

const TEXT_FILE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.config',
  '.cpp',
  '.cs',
  '.css',
  '.env',
  '.gradle',
  '.graphql',
  '.h',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.kts',
  '.m',
  '.md',
  '.mm',
  '.plist',
  '.properties',
  '.rb',
  '.sh',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const SECRET_PATTERNS = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'AWS access key id', regex: /(?:A3T|AKIA|ASIA|AGPA|AIDA|AROA|AIPA)[0-9A-Z]{16}/g },
  { name: 'Stripe secret key', regex: /(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}/g },
  { name: 'Stripe webhook secret', regex: /whsec_[0-9A-Za-z]{16,}/g },
  { name: 'GitHub token', regex: /gh[oprsu]_[0-9A-Za-z]{36}/g },
  { name: 'GitHub fine-grained token', regex: /github_pat_[0-9A-Za-z_]{40,}/g },
  { name: 'Slack token', regex: /xox[baprs]-[0-9A-Za-z-]{20,}/g },
  { name: 'RSA private key', regex: /-----BEGIN RSA PRIVATE KEY-----/g },
  { name: 'OpenSSH private key', regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  {
    name: 'generic secret assignment',
    regex:
      /\b(?:api[_-]?key|secret|token|password|client[_-]?secret)\b\s*[:=]\s*["']([A-Za-z0-9_./+=~:-]{24,})["']/gi,
  },
];

const SAFE_VALUE_HINTS = [
  'changeme',
  'dummy',
  'example',
  'fake',
  'mock',
  'override',
  'placeholder',
  'redacted',
  'sample',
  'test',
  'your_',
  'your-',
];

const runGit = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const runGitleaksWhenAvailable = () => {
  try {
    execFileSync('gitleaks', ['protect', '--staged', '--redact', '--exit-code', '1'], {
      stdio: 'inherit',
    });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    process.exit(error.status ?? 1);
  }
};

const getExtension = (file) => {
  const index = file.lastIndexOf('.');
  return index === -1 ? '' : file.slice(index).toLowerCase();
};

const isProtectedPath = (file) => PROTECTED_ROOTS.some((root) => file.startsWith(root));

const isBlockedLocalFile = (file) => BLOCKED_LOCAL_FILES.some((pattern) => pattern.test(file));

const isTextFile = (file) => TEXT_FILE_EXTENSIONS.has(getExtension(file));

const isLikelyPlaceholder = (value) => {
  const normalized = value.toLowerCase();
  return SAFE_VALUE_HINTS.some((hint) => normalized.includes(hint));
};

const shannonEntropy = (value) => {
  const chars = new Map();
  for (const char of value) {
    chars.set(char, (chars.get(char) ?? 0) + 1);
  }

  return Array.from(chars.values()).reduce((entropy, count) => {
    const probability = count / value.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
};

const getStagedFiles = () => {
  const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return output ? output.split('\n').filter(Boolean) : [];
};

const readStagedFile = (file) => {
  try {
    return execFileSync('git', ['show', `:${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return '';
  }
};

const findLineNumber = (content, index) => content.slice(0, index).split('\n').length;

const findings = [];
runGitleaksWhenAvailable();

const stagedFiles = getStagedFiles().filter(isProtectedPath);

for (const file of stagedFiles) {
  if (isBlockedLocalFile(file)) {
    findings.push({
      file,
      line: 1,
      name: 'local secrets file',
    });
    continue;
  }

  if (!isTextFile(file)) continue;

  const content = readStagedFile(file);
  if (!content) continue;

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[1] ?? match[0];
      if (pattern.name === 'generic secret assignment') {
        if (isLikelyPlaceholder(value) || shannonEntropy(value) < 3.5) continue;
      }

      findings.push({
        file,
        line: findLineNumber(content, match.index),
        name: pattern.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Secret scan failed. Remove these staged values before committing:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.name})`);
  }
  console.error('Values are intentionally not printed. Rotate any real secret that was staged.');
  process.exit(1);
}
