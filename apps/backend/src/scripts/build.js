const esbuild = require('esbuild');
const pkg = require('../package.json');

const externals = Object.keys(pkg.dependencies || {});

esbuild.build({
  entryPoints: ['./src/main.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/index.js',
  external: externals,
  
}).catch(() => process.exit(1));