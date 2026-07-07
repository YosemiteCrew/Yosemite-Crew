import * as fs from 'node:fs';
import * as path from 'node:path';

export const TEMPLATES = ['api-starter'] as const;

export type TemplateName = (typeof TEMPLATES)[number];

export function isTemplateName(value: string): value is TemplateName {
  return (TEMPLATES as readonly string[]).includes(value);
}

/**
 * Files that cannot be stored in the templates directory under their real
 * name (npm never packs .gitignore files, and git would honour one inside
 * the repo), stored with a leading underscore instead and renamed on copy.
 */
const RENAME_FILES: Record<string, string> = {
  _gitignore: '.gitignore',
};

/** Placeholder substituted with the project name in every template file. */
const NAME_PLACEHOLDER = '{{name}}';

export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaffoldError';
  }
}

export interface ScaffoldOptions {
  /** Validated kebab-case project name. */
  projectName: string;
  /** Template to copy, e.g. "api-starter". */
  template: string;
  /** Directory the project directory is created in. */
  cwd: string;
  /** Absolute path to the packaged templates/ directory. */
  templatesRoot: string;
}

export interface ScaffoldResult {
  targetDir: string;
  /** Paths relative to targetDir, sorted, using "/" separators. */
  filesWritten: string[];
}

/**
 * Copies templates/<template> into <cwd>/<projectName>, substituting the
 * {{name}} placeholder in every file. Refuses to write into an existing
 * non-empty directory so it can never clobber user files.
 */
export function scaffold(options: ScaffoldOptions): ScaffoldResult {
  const { projectName, template, cwd, templatesRoot } = options;

  const templateDir = path.join(templatesRoot, template);
  if (!fs.existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) {
    throw new ScaffoldError(
      `Unknown template "${template}". Available templates: ${TEMPLATES.join(', ')}.`
    );
  }

  const targetDir = path.resolve(cwd, projectName);
  if (fs.existsSync(targetDir)) {
    if (!fs.statSync(targetDir).isDirectory()) {
      throw new ScaffoldError(
        `Cannot create project: "${targetDir}" already exists and is not a directory.`
      );
    }
    if (fs.readdirSync(targetDir).length > 0) {
      throw new ScaffoldError(
        `Cannot create project: directory "${targetDir}" already exists and is not empty.`
      );
    }
  }

  const filesWritten: string[] = [];
  copyDir(templateDir, targetDir, projectName, '', filesWritten);
  filesWritten.sort(compareCodeUnits);
  return { targetDir, filesWritten };
}

/** Deterministic UTF-16 code-unit order, independent of the host locale. */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function copyDir(
  sourceDir: string,
  destinationDir: string,
  projectName: string,
  relativeDir: string,
  filesWritten: string[]
): void {
  fs.mkdirSync(destinationDir, { recursive: true });
  const entries = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .sort((a, b) => compareCodeUnits(a.name, b.name));

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(
        sourcePath,
        path.join(destinationDir, entry.name),
        projectName,
        joinRelative(relativeDir, entry.name),
        filesWritten
      );
      continue;
    }

    const outputName = RENAME_FILES[entry.name] ?? entry.name;
    const content = fs.readFileSync(sourcePath, 'utf8').replaceAll(NAME_PLACEHOLDER, projectName);
    fs.writeFileSync(path.join(destinationDir, outputName), content);
    filesWritten.push(joinRelative(relativeDir, outputName));
  }
}

function joinRelative(relativeDir: string, name: string): string {
  return relativeDir === '' ? name : `${relativeDir}/${name}`;
}
