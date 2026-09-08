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
      "const StatusPill = () => null;\nexport default StatusPill;\n",
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
      "const WidgetSummary = () => null;\nexport default WidgetSummary;\n",
      'src/app/features/widgets/Fine.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('does not fire outside features/ - primitives declare their own name', () => {
    const messages = lintTsx(
      "const StatusPill = () => null;\nexport default StatusPill;\n",
      'src/app/ui/primitives/StatusPill/StatusPill.tsx'
    );
    expect(messages).toHaveLength(0);
  });

  it('does not fire in a story or test fixture', () => {
    expect(
      lintTsx("const StatusPill = () => null;\n", 'src/app/features/widgets/Bad.stories.tsx')
    ).toHaveLength(0);
    expect(
      lintTsx("const StatusPill = () => null;\n", 'src/app/features/widgets/__tests__/Bad.test.tsx')
    ).toHaveLength(0);
  });

  it('a delegate wrapper renamed away from the collision is clean', () => {
    // The actual fix applied in this PR: a local wrapper that delegates to the
    // real primitive is fine once it no longer shares its name.
    const messages = lintTsx(
      "const VisitStatusPill = () => null;\nexport default VisitStatusPill;\n",
      'src/app/features/appointments/pages/AppointmentWorkspace/components/OutpatientSchedule.tsx'
    );
    expect(messages).toHaveLength(0);
  });
});
