const quote = (file) => `"${file.replaceAll('"', '\\"')}"`;
const isMobilePath = (file) =>
  file.startsWith('apps/mobileAppYC/') || file.includes('/apps/mobileAppYC/');
const toMobileRelativePath = (file) => {
  if (file.startsWith('apps/mobileAppYC/')) {
    return file.replace(/^apps\/mobileAppYC\//, '');
  }
  const marker = '/apps/mobileAppYC/';
  const index = file.indexOf(marker);
  return index >= 0 ? file.slice(index + marker.length) : file;
};

module.exports = {
  '**/*.{js,jsx,ts,tsx,mjs}': (files) => {
    const mobileFiles = files
      .filter((file) => isMobilePath(file))
      .map((file) => toMobileRelativePath(file));
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
        `pnpm --filter mobileAppYC exec eslint --fix --max-warnings=0 ${mobileFiles.map(quote).join(' ')}`
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
