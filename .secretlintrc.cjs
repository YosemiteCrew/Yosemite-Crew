module.exports = {
  rules: [
    {
      id: '@secretlint/secretlint-rule-preset-recommend'
    },
    {
      id: '@secretlint/secretlint-rule-no-dotenv'
    }
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/.turbo/**',
    '**/pnpm-lock.yaml',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.pdf',
    '**/*.otf',
    '**/*.ttf',
    '**/*.woff',
    '**/*.woff2',
    '**/*.mp4',
    '**/*.mov',
    '**/*.zip'
  ]
};
