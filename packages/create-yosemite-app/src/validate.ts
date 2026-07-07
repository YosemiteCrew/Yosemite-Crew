const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// npm's package name length limit; the project name doubles as the
// generated package.json name.
const MAX_NAME_LENGTH = 214;

/**
 * Validates a project name. Returns null when the name is acceptable,
 * otherwise a human-readable error message.
 *
 * The name becomes both the target directory and the generated package
 * name, so it must be strict kebab-case with no path separators.
 */
export function validateProjectName(name: string): string | null {
  if (!name) {
    return 'Project name is required.';
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Project name must be at most ${MAX_NAME_LENGTH} characters.`;
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return 'Project name must not contain path separators or "..".';
  }
  if (!KEBAB_CASE.test(name)) {
    return (
      'Project name must be kebab-case: lowercase letters and digits ' +
      'separated by single hyphens, starting with a letter (for example "my-integration").'
    );
  }
  return null;
}
