module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test']
    ],
    'scope-enum': [
      2,
      'always',
      [
        'backend',
        'frontend',
        'mobile',
        'dev-docs',
        'types',
        'fhirtypes',
        'repo',
        'ci',
        'docs'
      ]
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100]
  }
};
