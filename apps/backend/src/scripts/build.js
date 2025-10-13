const path = require('path');
const esbuild = require('esbuild');
const pkg = require('../../package.json');

const externals = Object.keys(pkg.dependencies || {});

const entry = path.resolve(__dirname, '../main.ts');
const outfile = path.resolve(__dirname, '../../dist/index.js');

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  outfile: outfile,
  external: externals,
}).catch(() => process.exit(1));