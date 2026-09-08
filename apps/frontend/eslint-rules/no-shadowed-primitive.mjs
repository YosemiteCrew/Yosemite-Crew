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
// Reads the primitive directory names from disk once at rule creation, so a
// new primitive is covered automatically - nobody has to remember to add its
// name to a list here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRIMITIVES_DIR = path.join(HERE, '../src/app/ui/primitives');

const primitiveNames = (() => {
  try {
    return new Set(
      fs.readdirSync(PRIMITIVES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    );
  } catch {
    return new Set();
  }
})();

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
        "'{{name}}' shadows the shared primitive at ui/primitives/{{name}}. " +
        'Import the primitive (aliased if you need a differently-named local ' +
        'wrapper) instead of redeclaring it - a local copy silently diverges ' +
        'from the design system and stops receiving its fixes.',
    },
  },
  create(context) {
    if (primitiveNames.size === 0) return {};
    const filename = context.filename ?? context.getFilename();
    // Only feature code is in scope. The primitives themselves, of course,
    // declare their own name; stories and tests may deliberately construct a
    // conflicting fixture.
    if (!filename.includes(`${path.sep}features${path.sep}`)) return {};
    if (/\.(stories|test|spec)\.[tj]sx?$/.test(filename)) return {};
    if (filename.includes(`__tests__${path.sep}`)) return {};

    const checkId = (idNode) => {
      if (idNode?.type === 'Identifier' && primitiveNames.has(idNode.name)) {
        context.report({ node: idNode, messageId: 'shadowed', data: { name: idNode.name } });
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
    };
  },
};

export default { rules: { 'no-shadowed-primitive': rule } };
