/**
 * Guard: nobody hand-rolls a column-header band again.
 *
 * PIMS grew five separate header recipes because the appearance lived in a
 * class string that was copied from component to component. Measured live on a
 * single Organisation page there were three at once over the same `--screen-2`
 * band: the real `th` at 10.5px/0.1em/11px-20px/sticky, the Team+Rooms grid at
 * 10px/9px-20px/static, and the Services grid at 10px/10px-22px/static. None of
 * that is catchable by lint, types or a render test - the page looks plausible
 * either way - so it is asserted here against the source itself.
 *
 * If this fails: use `<TableHead>` (ui/tables/TableHead.tsx) for a grid or flex
 * shell, or `<GenericTable>` for real tabular markup. Do not add your file to
 * the allowlist to make the test pass.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const APP_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * The only places the header recipe is allowed to be spelled out. Everything
 * else must consume it.
 */
const ALLOWED = new Set([
  // Owns the recipe.
  'ui/tables/GenericTable/Generictable.css',
  // The two sanctioned consumers of it.
  'ui/tables/TableHead.tsx',
  'ui/tables/GenericTable/GenericTable.tsx',
]);

const listFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.tsx$/.test(entry) && !entry.includes('.stories.')) {
      out.push(full);
    }
  }
  return out;
};

/**
 * A header band is uppercase micro-type WITH the tracking, laid over a column
 * track. Matching must happen inside a SINGLE element's styling, not across the
 * whole file: a `--screen-2` side panel that merely happens to contain an
 * uppercase label somewhere else is not a header, and a guard that cries wolf
 * gets muted rather than obeyed.
 */
const CLASS_ATTRIBUTE = /className=\{?[`"'][^`"']*[`"']/g;

/**
 * The signature of the recipe: uppercase, the 0.1em tracking, at header size.
 * A column track is deliberately NOT required - shells pass theirs through an
 * interpolated const (`${ROW_GRID}`), so requiring a literal `grid` here would
 * miss the very cases this guard is for.
 */
const isHeaderStyling = (chunk: string): boolean =>
  /uppercase/.test(chunk) &&
  /tracking-\[0\.1/.test(chunk) &&
  /text-\[(9|10|10\.5|11)(\.\d+)?px\]/.test(chunk);

/**
 * ...and it is a COLUMN header only if the file also declares a column track for
 * the rows beneath. Without this, every uppercase eyebrow and badge in PIMS
 * matches, and the guard becomes noise. The track may be interpolated
 * (`${ROW_GRID}`), so the const declaration in the same file counts.
 */
const declaresColumnTrack = (source: string): boolean =>
  /grid-cols-\[/.test(source) ||
  /gridTemplateColumns/.test(source) ||
  /\b(GRID_COLS|GRID_COLUMNS|ROW_GRID)\b/.test(source);

const looksLikeHeaderBand = (source: string): boolean =>
  !/yc-table-head/.test(source) &&
  declaresColumnTrack(source) &&
  (source.match(CLASS_ATTRIBUTE) ?? []).some(isHeaderStyling);

describe('table header consistency', () => {
  const offenders = listFiles(APP_ROOT)
    .filter((file) => {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join('/');
      return !ALLOWED.has(rel);
    })
    .filter((file) => looksLikeHeaderBand(readFileSync(file, 'utf8')))
    .map((file) => path.relative(APP_ROOT, file).split(path.sep).join('/'));

  it('has no component drawing its own column-header band', () => {
    expect(offenders).toEqual([]);
  });

  it('keeps the shared recipe in step with the real table header', () => {
    const css = readFileSync(
      path.join(APP_ROOT, 'ui/tables/GenericTable/Generictable.css'),
      'utf8'
    );
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf('}', start));
    };
    const th = block('.TableDiv thead tr th {');
    const shared = block('.yc-table-head {');

    // The two must not drift; a mismatch here is the bug this guard exists for.
    for (const decl of [
      'font-size: 10.5px',
      'font-weight: 700',
      'letter-spacing: 0.1em',
      'text-transform: uppercase',
      'background: var(--screen-2)',
      'position: sticky',
      'box-shadow: 0 1px 0 var(--hairline)',
    ]) {
      expect(th).toContain(decl);
      expect(shared).toContain(decl);
    }
  });
});
