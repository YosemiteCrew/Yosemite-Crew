// Forbids declaring a top-level component in features/ whose name collides
// with a shared primitive under ui/primitives/.
//
// This is the exact bug the freeze audit found four times over: a feature file
// declares its own `const StatusPill` or `const SectionCard`, and the local
// version silently diverges from the design system - different geometry,
// missing tokens, no shared fix when the primitive is patched. The federation
// "transparent card" defect and three hand-rolled status pills were all this
// one pattern.
//
// Indexes the ACTUAL exported value names under ui/primitives/ (default
// exports, named const/function/class exports, and `export { x as Y }`
// re-exports), not directory basenames. A directory's basename is frequently
// not a name anything exports - e.g. PanelStates/ exports PanelEmptyState and
// PanelLoadingRows, never a component called PanelStates - so basename
// matching both missed the real shadow risk and flagged unrelated
// declarations that happened to share a folder's name.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRIMITIVES_DIR = path.join(HERE, '../src/app/ui/primitives');

const SOURCE_FILE = /\.(ts|tsx)$/;
const SKIP_FILE = /\.(stories|test|spec)\.[tj]sx?$/;

const DEFAULT_EXPORT = /^export\s+default\s+([A-Z][A-Za-z0-9_$]*)\s*;/gm;
const NAMED_VALUE_EXPORT = /^export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9_$]*)/gm;
// `export { default as Primary } from '...'` / `export { Foo, Bar as Baz }` -
// deliberately excludes `export type { ... }`, which has "type" between
// "export" and "{" and so never matches this pattern.
const NAMED_LIST_EXPORT = /^export\s*\{([^}]+)\}\s*(?:from\s+['"][^'"]+['"])?\s*;?\s*$/gm;

const namesFromExportList = (list) =>
  list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const asMatch = entry.match(/\bas\s+([A-Za-z0-9_$]+)\s*$/);
      return asMatch ? asMatch[1] : entry.split(/\s+/)[0];
    })
    .filter((name) => /^[A-Z]/.test(name));

// Bounds two things Aikido flagged on the recursive walk below: unbounded
// recursion depth on a pathological directory tree, and `entry.name` (though
// it only ever comes from readdirSync's own listing, never external input)
// resolving outside `dir` - entries are rejected unless they stay under it.
const MAX_DEPTH = 12;

const collectSourceFiles = (dir, depth = 0) => {
  if (depth > MAX_DEPTH) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const full = path.join(dir, entry.name);
    const relative = path.relative(dir, full);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return [];
    if (entry.isDirectory()) return collectSourceFiles(full, depth + 1);
    if (SOURCE_FILE.test(entry.name) && !SKIP_FILE.test(entry.name)) return [full];
    return [];
  });
};

// name -> path of the primitive file it's actually exported from, relative
// to ui/primitives/, for the report message.
const buildPrimitiveIndex = () => {
  const index = new Map();
  for (const file of collectSourceFiles(PRIMITIVES_DIR)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const relPath = path.relative(PRIMITIVES_DIR, file);
    const add = (name) => {
      if (!index.has(name)) index.set(name, relPath);
    };
    for (const m of text.matchAll(DEFAULT_EXPORT)) add(m[1]);
    for (const m of text.matchAll(NAMED_VALUE_EXPORT)) add(m[1]);
    for (const m of text.matchAll(NAMED_LIST_EXPORT)) {
      namesFromExportList(m[1]).forEach(add);
    }
  }
  return index;
};

const primitiveIndex = buildPrimitiveIndex();

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a features/ component whose name shadows a shared ui/primitives/ export.',
    },
    schema: [],
    messages: {
      shadowed:
        "'{{name}}' shadows the shared primitive exported from ui/primitives/{{path}}. " +
        'Import the primitive (aliased if you need a differently-named local ' +
        'wrapper) instead of redeclaring it - a local copy silently diverges ' +
        'from the design system and stops receiving its fixes.',
    },
  },
  create(context) {
    if (primitiveIndex.size === 0) return {};
    const filename = context.filename ?? context.getFilename();
    // In scope: features/ (the freeze audit's original finding) and the rest
    // of ui/ (InventoryTable.tsx, under ui/tables/, had this exact bug too -
    // a local StatusPill wrapper around SharedStatusPill). Out of scope: the
    // primitives themselves declare their own name; ui/primitives/ is excluded
    // outright rather than just skipped-on-collision, so a primitive's own
    // internal helpers are never second-guessed by this rule. Stories and
    // tests may deliberately construct a conflicting fixture.
    const inFeatures = filename.includes(`${path.sep}features${path.sep}`);
    const inUiOutsidePrimitives =
      filename.includes(`${path.sep}ui${path.sep}`) &&
      !filename.includes(`${path.sep}ui${path.sep}primitives${path.sep}`);
    if (!inFeatures && !inUiOutsidePrimitives) return {};
    if (/\.(stories|test|spec)\.[tj]sx?$/.test(filename)) return {};
    if (filename.includes(`__tests__${path.sep}`)) return {};

    const checkId = (idNode) => {
      const primitivePath =
        idNode?.type === 'Identifier' ? primitiveIndex.get(idNode.name) : undefined;
      if (primitivePath) {
        context.report({
          node: idNode,
          messageId: 'shadowed',
          data: { name: idNode.name, path: primitivePath },
        });
      }
    };

    return {
      // const StatusPill = (...) => ...
      VariableDeclarator(node) {
        checkId(node.id);
      },
      // function StatusPill(...) {...}
      FunctionDeclaration(node) {
        checkId(node.id);
      },
      // class StatusPill extends React.Component {...} - the primitive index
      // already recognizes exported classes, so this closes the matching gap
      // on the report side; a class component can shadow just as easily.
      ClassDeclaration(node) {
        checkId(node.id);
      },
    };
  },
};

const noShadowedPrimitivePlugin = { rules: { 'no-shadowed-primitive': rule } };
export default noShadowedPrimitivePlugin;
