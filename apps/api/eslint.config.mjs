import baseConfig from '../../eslint.config.mjs';

export default [...baseConfig, {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      "no-var": "off",
      "no-useless-escape": "off",
      "prefer-const": "off",
      "no-constant-binary-expression": "off"
    }
  }];
