import { parseArgs } from 'node:util';

import { isTemplateName, scaffold, ScaffoldError, TEMPLATES } from './scaffold.js';
import { validateProjectName } from './validate.js';

export interface RunIo {
  /** Directory the project directory is created in. */
  cwd: string;
  /** Absolute path to the packaged templates/ directory. */
  templatesRoot: string;
  log: (line: string) => void;
  error: (line: string) => void;
}

const USAGE = [
  'Usage: create-yosemite-app <project-name> [options]',
  '',
  'Creates a Yosemite Crew Developer Data API integration project in',
  '<project-name>/ under the current directory.',
  '',
  'Arguments:',
  '  project-name       kebab-case directory name, e.g. "my-integration"',
  '',
  'Options:',
  '  --template <name>  project template (default: "api-starter")',
  '  -h, --help         show this help',
  '',
  'Templates:',
  '  api-starter        TypeScript starter that lists upcoming appointments',
  '                     and reads API usage via the read-only Data API v1',
].join('\n');

/**
 * Runs the CLI against the given argv (everything after the node binary and
 * script path). Returns the process exit code. Non-interactive by design:
 * everything is provided via arguments, nothing is prompted.
 */
export function run(argv: string[], io: RunIo): number {
  let positionals: string[];
  let template: string;
  let help: boolean;
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        template: { type: 'string', default: 'api-starter' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
    positionals = parsed.positionals;
    template = parsed.values.template ?? 'api-starter';
    help = parsed.values.help ?? false;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    io.error('');
    io.error(USAGE);
    return 1;
  }

  if (help) {
    io.log(USAGE);
    return 0;
  }

  if (positionals.length === 0) {
    io.error('Missing required <project-name> argument.');
    io.error('');
    io.error(USAGE);
    return 1;
  }
  if (positionals.length > 1) {
    io.error(`Unexpected extra argument "${positionals[1]}".`);
    io.error('');
    io.error(USAGE);
    return 1;
  }

  const projectName = positionals[0];
  const nameError = validateProjectName(projectName);
  if (nameError) {
    io.error(nameError);
    return 1;
  }

  if (!isTemplateName(template)) {
    io.error(`Unknown template "${template}". Available templates: ${TEMPLATES.join(', ')}.`);
    return 1;
  }

  let targetDir: string;
  let filesWritten: string[];
  try {
    ({ targetDir, filesWritten } = scaffold({
      projectName,
      template,
      cwd: io.cwd,
      templatesRoot: io.templatesRoot,
    }));
  } catch (error) {
    if (error instanceof ScaffoldError) {
      io.error(error.message);
      return 1;
    }
    throw error;
  }

  io.log(`Created ${projectName} at ${targetDir}`);
  io.log('');
  io.log('Files:');
  for (const file of filesWritten) {
    io.log(`  ${file}`);
  }
  io.log('');
  io.log('Next steps:');
  io.log(`  cd ${projectName}`);
  io.log('  npm install');
  io.log('  cp .env.example .env');
  io.log('  # paste an API key from the developer portal (/developers/api-keys) into .env');
  io.log('  npm run dev');
  return 0;
}
