import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import esbuild from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

const externals = Object.keys(pkg.dependencies || {})

const entry = path.resolve(__dirname, '../main.ts')
const outfile = path.resolve(__dirname, '../../dist/index.js')

esbuild
    .build({
        entryPoints: [entry],
        bundle: true,
        platform: 'node',
        outfile,
        external: externals,
    })
    .catch(() => process.exit(1))
