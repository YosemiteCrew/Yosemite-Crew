import v8 from 'node:v8';
import { Linter } from 'eslint';
import ruleModule from '../../../../eslint-rules/no-shadowed-primitive.mjs';

// jest.setup.ts's jsdom sandbox does not forward Node's global structuredClone,
// which ESLint's flat-config internals use to clone rule schemas. Node's own
// v8 module gives a faithful (non-lossy, for plain config data) equivalent.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => v8.deserialize(v8.serialize(value));
}

/**
 * Drives the rule through ESLint's own Linter rather than asserting on the
 * rule object's shape, so this fails if the rule stops firing - the same
 * property every other check in this freeze effort was held to. A manual
 * one-off check (which is how this rule was first verified) proves nothing
 * once the person who ran it moves on; this is the version that survives.
 */
const linter = new Linter();

const lintTsx = (code: string, filename: string) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { local: ruleModule },
        rules: { 'local/no-shadowed-primitive': 'error' },
      },
    ] as never,
    filename
  );

describe('no-shadowed-primitive', () => {
  it('flags a features/ component whose name shadows a real primitive', () => {
    const messages = lintTsx(
      'const StatusPill = () => null;\nexport default StatusPill;\n',
      'src/app/features/widgets/Bad.tsx'
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBe('local/no-shadowed-primitive');
    expect(messages[0].message).toContain('StatusPill');
    expect(messages[0].message).toContain('shadows the shared primitive');
  });

  it('also flags a shadowed function declaration, not only const', () => {
    const messages = lintTsx(
      'function SectionCard() { return null; }\n',
      'src/app/features/widgets/Bad2.tsx'
    );
    expect(messages).toHaveLength(1);
  });

  it('does not fire on an unrelated component name', () => {
    const messages = lintTsx(
      'const WidgetSummary = () => null;\nexport default WidgetSummary;\n',
      'src/app/features/widgets/Fine.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('does not fire outside features/ - primitives declare their own name', () => {
    const messages = lintTsx(
      'const StatusPill = () => null;\nexport default StatusPill;\n',
      'src/app/ui/primitives/StatusPill/StatusPill.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('does not fire in a story or test fixture', () => {
    expect(
      lintTsx('const StatusPill = () => null;\n', 'src/app/features/widgets/Bad.stories.tsx')
    ).toHaveLength(0);
    expect(
      lintTsx('const StatusPill = () => null;\n', 'src/app/features/widgets/__tests__/Bad.test.tsx')
    ).toHaveLength(0);
  });

  it('a delegate wrapper renamed away from the collision is clean', () => {
    // The actual fix applied in this PR: a local wrapper that delegates to the
    // real primitive is fine once it no longer shares its name.
    const messages = lintTsx(
      'const VisitStatusPill = () => null;\nexport default VisitStatusPill;\n',
      'src/app/features/appointments/pages/AppointmentWorkspace/components/OutpatientSchedule.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('derives protected names from actual exports, not directory basenames', () => {
    // PanelStates/ is a real primitive directory, but the file inside it never
    // declares anything called PanelStates - it exports PanelEmptyState and
    // PanelLoadingRows. Basename matching used to flag the harmless name below
    // and miss the two that actually matter; export-based matching is the
    // inverse of that on both counts.
    const shadowsUnexportedDirName = lintTsx(
      'const PanelStates = () => null;\nexport default PanelStates;\n',
      'src/app/features/widgets/Fine2.tsx'
    );
    expect(shadowsUnexportedDirName).toHaveLength(0);

    const shadowsRealExport = lintTsx(
      'const PanelEmptyState = () => null;\nexport default PanelEmptyState;\n',
      'src/app/features/widgets/Bad3.tsx'
    );
    expect(shadowsRealExport).toHaveLength(1);
    expect(shadowsRealExport[0].message).toContain('PanelStates/PanelStates.tsx');
  });

  it('does not protect a bare index.ts namespace re-export (`export * as Buttons`)', () => {
    // primitives/index.ts re-exports the Buttons directory as a namespace;
    // that binding is not a component and declaring a local one named
    // Buttons is not the shadow bug this rule exists to catch.
    const messages = lintTsx(
      'const Buttons = () => null;\nexport default Buttons;\n',
      'src/app/features/widgets/Fine3.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('protects a named re-export reached only through an index barrel', () => {
    // Buttons/index.tsx re-exports Primary via `export { default as Primary }
    // from './Primary'` - the name never appears as `export default Primary`
    // or `export const Primary` in any single file, only in this list form.
    const messages = lintTsx(
      'const Primary = () => null;\nexport default Primary;\n',
      'src/app/features/widgets/Bad4.tsx'
    );
    expect(messages).toHaveLength(1);
  });
});

describe('no-shadowed-primitive - primitive index resilience', () => {
  afterEach(() => {
    jest.dontMock('node:fs');
    jest.resetModules();
  });

  it('never reports (fails safe) if ui/primitives cannot be read', () => {
    jest.resetModules();
    jest.doMock('node:fs', () => ({
      ...jest.requireActual('node:fs'),
      readdirSync: () => {
        throw new Error('ENOENT: no such file or directory');
      },
    }));

    let freshModule: { default?: typeof ruleModule } & typeof ruleModule;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-require a mocked node:fs synchronously inside isolateModules
      freshModule = require('../../../../eslint-rules/no-shadowed-primitive.mjs');
    });
    const freshPlugin = freshModule!.default ?? freshModule!;

    const freshLinter = new Linter();
    const messages = freshLinter.verify(
      'const StatusPill = () => null;\nexport default StatusPill;\n',
      [
        {
          files: ['**/*.tsx'],
          languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { local: freshPlugin },
          rules: { 'local/no-shadowed-primitive': 'error' },
        },
      ] as never,
      'src/app/features/widgets/Bad.tsx'
    );

    // A directory read failure must never crash the lint run and must never
    // silently allow the OPPOSITE - reporting spurious findings from an
    // empty/garbage index. The safe failure mode is "no findings at all".
    expect(messages).toHaveLength(0);
  });
});
