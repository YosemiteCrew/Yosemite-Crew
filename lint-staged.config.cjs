const quote = (file) => `"${file.replaceAll('"', '\\"')}"`;

// secretlint 13 takes file paths literally, so a Next.js route path like
// `(share)/passport/[id]/X.tsx` needs only shell quoting. This file used to
// escape `(`, `[` and `]` for the globbing 11.x; under 13.x an escaped path names
// a file that does not exist. Staged alone it failed the hook with "Not found
// target files", and next to any other staged file it was skipped without a
// word, so a secret in a dynamic route was never scanned.
// scripts/ci/lint-staged-secretlint.test.mjs runs this task the way lint-staged
// does and fails if either comes back.
const isMobilePath = (file) =>
  file.startsWith('apps/mobileAppYC/') || file.includes('/apps/mobileAppYC/');
const isFrontendPath = (file) =>
  file.startsWith('apps/frontend/') || file.includes('/apps/frontend/');
const MOBILE_ESLINT_IGNORED_FILES = new Set([
  '.eslintrc.js',
  'jest.config.js',
  'jest.setup.js',
  'jest.setup-before-env.js',
  'babel.config.js',
  'metro.config.js',
  'index.js',
  'react-native.config.js',
  '.detoxrc.js',
]);
const toMobileRelativePath = (file) => {
  if (file.startsWith('apps/mobileAppYC/')) {
    return file.replace(/^apps\/mobileAppYC\//, '');
  }
  const marker = '/apps/mobileAppYC/';
  const index = file.indexOf(marker);
  return index >= 0 ? file.slice(index + marker.length) : file;
};
const shouldLintWithMobileEslint = (relativePath) => {
  if (!relativePath) return false;
  if (relativePath.startsWith('android/app/build/')) return false;
  if (relativePath.endsWith('/jest.config.js')) return false;
  if (MOBILE_ESLINT_IGNORED_FILES.has(relativePath)) return false;
  return true;
};
const toFrontendRelativePath = (file) => {
  if (file.startsWith('apps/frontend/')) {
    return file.replace(/^apps\/frontend\//, '');
  }
  const marker = '/apps/frontend/';
  const index = file.indexOf(marker);
  return index >= 0 ? file.slice(index + marker.length) : file;
};

module.exports = {
  '**/*.{js,jsx,ts,tsx,mjs}': (files) => {
    const mobileFiles = files
      .filter((file) => isMobilePath(file))
      .map((file) => toMobileRelativePath(file))
      .filter((file) => shouldLintWithMobileEslint(file));
    const frontendFiles = files
      .filter((file) => isFrontendPath(file))
      .map((file) => toFrontendRelativePath(file));
    const nonMobileFiles = files.filter(
      (file) =>
        !isMobilePath(file) &&
        !isFrontendPath(file) &&
        !file.includes('/apps/backend/') &&
        !file.startsWith('apps/backend/') &&
        !file.includes('/packages/') &&
        !file.startsWith('packages/')
    );
    const commands = [];

    if (nonMobileFiles.length > 0) {
      commands.push(
        `sh -c 'ESLINT_USE_FLAT_CONFIG=false eslint --fix --max-warnings=0 "$@"' -- ${nonMobileFiles
          .map(quote)
          .join(' ')}`
      );
    }

    if (frontendFiles.length > 0) {
      commands.push(
        `pnpm --filter frontend exec eslint --fix --max-warnings=0 ${frontendFiles
          .map(quote)
          .join(' ')}`
      );
    }

    if (mobileFiles.length > 0) {
      commands.push(
        `pnpm --filter mobileAppYC exec eslint --fix --max-warnings=0 ${mobileFiles
          .map(quote)
          .join(' ')}`
      );
    }

    commands.push(`prettier --write ${files.map(quote).join(' ')}`);
    return commands;
  },
  '**/*.{json,md,css,scss,html,yml,yaml}': (files) => [
    `prettier --write ${files.map(quote).join(' ')}`,
  ],
  '**/*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml,env,txt,sh,swift,plist,properties,gradle,kt,kts,java,xml}':
    (files) => [`secretlint --maskSecrets ${files.map(quote).join(' ')}`],
};
