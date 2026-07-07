import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { scaffold, ScaffoldError, TEMPLATES, isTemplateName } from '../src/scaffold.js';

const templatesRoot = path.resolve(__dirname, '..', 'templates');

// In UTF-16 code-unit order, matching scaffold's deterministic sort.
const EXPECTED_FILES = [
  '.env.example',
  '.gitignore',
  'README.md',
  'package.json',
  'src/client.ts',
  'src/index.ts',
  'src/types.ts',
  'tsconfig.json',
];

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cya-scaffold-test-'));
  tmpDirs.push(dir);
  return dir;
}

function walk(dir: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...walk(path.join(dir, entry.name), relative));
    } else {
      files.push(relative);
    }
  }
  // Default sort = code-unit order, matching scaffold's deterministic sort.
  return files.sort();
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('templates registry', () => {
  it('offers exactly the api-starter template', () => {
    expect(TEMPLATES).toEqual(['api-starter']);
  });

  it('recognises template names', () => {
    expect(isTemplateName('api-starter')).toBe(true);
    expect(isTemplateName('nope')).toBe(false);
  });

  it('stores the gitignore as _gitignore so git and npm ignore rules never apply to it', () => {
    const templateDir = path.join(templatesRoot, 'api-starter');
    expect(fs.existsSync(path.join(templateDir, '_gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(templateDir, '.gitignore'))).toBe(false);
  });
});

describe('scaffold', () => {
  it('creates the full project tree', () => {
    const cwd = makeTmpDir();
    const result = scaffold({
      projectName: 'pet-sync',
      template: 'api-starter',
      cwd,
      templatesRoot,
    });

    expect(result.targetDir).toBe(path.join(cwd, 'pet-sync'));
    expect(result.filesWritten).toEqual(EXPECTED_FILES);
    expect(walk(result.targetDir)).toEqual(EXPECTED_FILES);
  });

  it('substitutes {{name}} everywhere and leaves no placeholder behind', () => {
    const cwd = makeTmpDir();
    const { targetDir, filesWritten } = scaffold({
      projectName: 'pet-sync',
      template: 'api-starter',
      cwd,
      templatesRoot,
    });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')
    ) as { name: string; private: boolean; scripts: Record<string, string> };
    expect(packageJson.name).toBe('pet-sync');
    expect(packageJson.private).toBe(true);
    expect(packageJson.scripts.build).toBe('tsc');

    const readme = fs.readFileSync(path.join(targetDir, 'README.md'), 'utf8');
    expect(readme).toContain('# pet-sync');

    for (const file of filesWritten) {
      const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
      expect(content).not.toContain('{{name}}');
    }
  });

  it('renames _gitignore to .gitignore and keeps .env ignored', () => {
    const cwd = makeTmpDir();
    const { targetDir } = scaffold({
      projectName: 'pet-sync',
      template: 'api-starter',
      cwd,
      templatesRoot,
    });

    expect(fs.existsSync(path.join(targetDir, '_gitignore'))).toBe(false);
    const gitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
    expect(gitignore.split('\n')).toContain('.env');
  });

  it('emits a strict tsconfig', () => {
    const cwd = makeTmpDir();
    const { targetDir } = scaffold({
      projectName: 'pet-sync',
      template: 'api-starter',
      cwd,
      templatesRoot,
    });

    const tsconfig = JSON.parse(fs.readFileSync(path.join(targetDir, 'tsconfig.json'), 'utf8')) as {
      compilerOptions: { strict: boolean };
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('scaffolds into an existing empty directory', () => {
    const cwd = makeTmpDir();
    fs.mkdirSync(path.join(cwd, 'pet-sync'));

    const { targetDir } = scaffold({
      projectName: 'pet-sync',
      template: 'api-starter',
      cwd,
      templatesRoot,
    });
    expect(walk(targetDir)).toEqual(EXPECTED_FILES);
  });

  it('refuses a non-empty target directory', () => {
    const cwd = makeTmpDir();
    fs.mkdirSync(path.join(cwd, 'pet-sync'));
    fs.writeFileSync(path.join(cwd, 'pet-sync', 'keep.txt'), 'precious');

    expect(() =>
      scaffold({ projectName: 'pet-sync', template: 'api-starter', cwd, templatesRoot })
    ).toThrow(ScaffoldError);
    expect(() =>
      scaffold({ projectName: 'pet-sync', template: 'api-starter', cwd, templatesRoot })
    ).toThrow(/not empty/);

    // The existing file must be untouched.
    expect(fs.readFileSync(path.join(cwd, 'pet-sync', 'keep.txt'), 'utf8')).toBe('precious');
  });

  it('refuses when the target path is a file', () => {
    const cwd = makeTmpDir();
    fs.writeFileSync(path.join(cwd, 'pet-sync'), 'not a directory');

    expect(() =>
      scaffold({ projectName: 'pet-sync', template: 'api-starter', cwd, templatesRoot })
    ).toThrow(/not a directory/);
  });

  it('rejects an unknown template', () => {
    const cwd = makeTmpDir();
    expect(() =>
      scaffold({ projectName: 'pet-sync', template: 'does-not-exist', cwd, templatesRoot })
    ).toThrow(/Unknown template "does-not-exist"/);
    expect(fs.existsSync(path.join(cwd, 'pet-sync'))).toBe(false);
  });
});
