import {readdirSync, readFileSync, statSync} from 'fs';
import {join} from 'path';

/**
 * Shared helper for the token guard tests, which each walk src/ looking for a
 * banned pattern. Extracted so the two of them stop duplicating the walk.
 */
export const SRC_DIR = join(__dirname, '..', '..', 'src');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Every src file whose contents match one of `patterns`, as paths relative to
 * src/, skipping anything in `allowed`.
 *
 * `require` narrows the scan to files that ALSO match it. A pattern like
 * `colorScheme="light"` is only meaningful on a glass surface - `colorScheme`
 * is a common enough prop name that banning the literal everywhere would fire
 * on unrelated APIs - so that guard passes the glass components as `require`.
 */
export const findSourceFilesMatching = (
  patterns: RegExp[],
  allowed: ReadonlySet<string> = new Set(),
  require?: RegExp,
): string[] => {
  const offenders: string[] = [];
  for (const file of walk(SRC_DIR)) {
    const rel = file.slice(SRC_DIR.length + 1);
    if (allowed.has(rel)) {
      continue;
    }
    const body = readFileSync(file, 'utf8');
    if (require && !require.test(body)) {
      continue;
    }
    if (patterns.some(pattern => pattern.test(body))) {
      offenders.push(rel);
    }
  }
  return offenders;
};
