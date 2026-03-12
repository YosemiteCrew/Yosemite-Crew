const quote = (file) => `"${file.replaceAll('"', '\\"')}"`;
const isMobilePath = (file) =>
  file.startsWith('apps/mobileAppYC/') || file.includes('/apps/mobileAppYC/');
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

module.exports = {
  '**/*.{js,jsx,ts,tsx,mjs}': (files) => {
    const mobileFiles = files
      .filter((file) => isMobilePath(file))
      .map((file) => toMobileRelativePath(file))
      .filter((file) => shouldLintWithMobileEslint(file));
    const nonMobileFiles = files.filter((file) => !isMobilePath(file));
    const commands = [];

    if (nonMobileFiles.length > 0) {
      commands.push(
        `sh -c 'ESLINT_USE_FLAT_CONFIG=false eslint --fix --max-warnings=0 "$@"' -- ${nonMobileFiles
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
  '**/*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml,env,txt,sh}': (files) => [
    `secretlint --maskSecrets ${files.map(quote).join(' ')}`,
  ],
};
