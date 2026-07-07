import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { run, type RunIo } from '../src/run.js';

const templatesRoot = path.resolve(__dirname, '..', 'templates');

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cya-run-test-'));
  tmpDirs.push(dir);
  return dir;
}

interface CapturedIo {
  io: RunIo;
  logs: string[];
  errors: string[];
}

function makeIo(cwd: string): CapturedIo {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    io: {
      cwd,
      templatesRoot,
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    },
    logs,
    errors,
  };
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('run', () => {
  it('scaffolds a project and prints next steps', () => {
    const cwd = makeTmpDir();
    const { io, logs, errors } = makeIo(cwd);

    const exitCode = run(['pet-sync'], io);

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
    expect(fs.existsSync(path.join(cwd, 'pet-sync', 'package.json'))).toBe(true);

    const output = logs.join('\n');
    expect(output).toContain('Created pet-sync');
    expect(output).toContain('Next steps:');
    expect(output).toContain('cd pet-sync');
    expect(output).toContain('cp .env.example .env');
    expect(output).toContain('/developers/api-keys');
  });

  it('accepts an explicit --template flag', () => {
    const cwd = makeTmpDir();
    const { io } = makeIo(cwd);

    expect(run(['pet-sync', '--template', 'api-starter'], io)).toBe(0);
    expect(fs.existsSync(path.join(cwd, 'pet-sync', 'src', 'client.ts'))).toBe(true);
  });

  it('prints usage and exits 0 for --help', () => {
    const cwd = makeTmpDir();
    const { io, logs } = makeIo(cwd);

    expect(run(['--help'], io)).toBe(0);
    expect(logs.join('\n')).toContain('Usage: create-yosemite-app');
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it('fails with usage when the project name is missing', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run([], io)).toBe(1);
    const output = errors.join('\n');
    expect(output).toContain('Missing required <project-name>');
    expect(output).toContain('Usage: create-yosemite-app');
  });

  it('fails on extra positional arguments', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run(['pet-sync', 'second'], io)).toBe(1);
    expect(errors.join('\n')).toContain('Unexpected extra argument "second"');
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it('fails on unknown flags', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run(['pet-sync', '--frobnicate'], io)).toBe(1);
    expect(errors.join('\n')).toContain('Usage: create-yosemite-app');
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it('rejects a non-kebab-case name without touching the filesystem', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run(['Pet_Sync'], io)).toBe(1);
    expect(errors.join('\n')).toContain('kebab-case');
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it('rejects path traversal names without touching the filesystem', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run(['../escape'], io)).toBe(1);
    expect(errors.join('\n')).toContain('path separators');
    expect(fs.readdirSync(cwd)).toEqual([]);
    expect(fs.existsSync(path.join(cwd, '..', 'escape'))).toBe(false);
  });

  it('rejects an unknown template', () => {
    const cwd = makeTmpDir();
    const { io, errors } = makeIo(cwd);

    expect(run(['pet-sync', '--template', 'nope'], io)).toBe(1);
    expect(errors.join('\n')).toContain('Unknown template "nope"');
    expect(errors.join('\n')).toContain('api-starter');
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it('refuses to overwrite a non-empty directory', () => {
    const cwd = makeTmpDir();
    fs.mkdirSync(path.join(cwd, 'pet-sync'));
    fs.writeFileSync(path.join(cwd, 'pet-sync', 'keep.txt'), 'precious');
    const { io, errors } = makeIo(cwd);

    expect(run(['pet-sync'], io)).toBe(1);
    expect(errors.join('\n')).toContain('not empty');
    expect(fs.readFileSync(path.join(cwd, 'pet-sync', 'keep.txt'), 'utf8')).toBe('precious');
  });
});
