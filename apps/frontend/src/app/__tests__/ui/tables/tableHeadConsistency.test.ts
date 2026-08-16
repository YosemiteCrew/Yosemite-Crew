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
const isHeaderStyling = (chunk: string): boolean => {
  if (!/uppercase/.test(chunk)) return false;
  // Either the arbitrary-value spelling...
  // Any arbitrary tracking, not just 0.1em: the inventory ABC header used
  // 0.08em and the first version of this check sailed straight past it.
  const arbitrary =
    /tracking-\[0?\.\d/.test(chunk) && /text-\[(9|10|10\.5|11)(\.\d+)?px\]/.test(chunk);
  // ...or the semantic-class one. The AppointmentWorkspace side modals used
  // `text-caption-2 font-medium tracking-wide` - 12px/500/0.025em, an order of
  // magnitude short on tracking - and the first version of this guard walked
  // straight past all five of them.
  const semantic =
    /text-caption-[12]|text-body-4/.test(chunk) && /tracking-(wide|\[0\.)/.test(chunk);
  return arbitrary || semantic;
};

/**
 * ...and it is a COLUMN header only if THIS ELEMENT lays its labels over a
 * column track. Checking the file instead of the element made every lone
 * uppercase eyebrow in a file that happens to contain a grid an offender -
 * InvoiceStep's "Payments" section label, for one - while checking neither
 * matched every badge in PIMS. The track is often interpolated
 * (`${ROW_GRID}`), so a *_GRID const reference in the class counts.
 */
const laysOverAColumnTrack = (chunk: string): boolean =>
  /grid-cols-\[/.test(chunk) ||
  /\$\{[A-Za-z_]*(GRID|Grid|grid)[A-Za-z_]*\}/.test(chunk) ||
  /\bgrid\b/.test(chunk);

/**
 * Exempt the migrated ELEMENT, never the whole file. A file-level exemption
 * meant one migrated header bought amnesty for every other band beside it -
 * `InvoiceStep.tsx` migrated its invoice list and the guard then stopped
 * looking at the nested Breakdown header two hundred lines below, which was
 * still hand-rolled. The guard passed with a live offender in the file it was
 * written to catch.
 */
const looksLikeHeaderBand = (source: string): boolean =>
  (source.match(CLASS_ATTRIBUTE) ?? [])
    .filter((chunk) => !/yc-table-head/.test(chunk))
    .some((chunk) => isHeaderStyling(chunk) && laysOverAColumnTrack(chunk));

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
      // Not --ink-faint: that is 2.91:1 on this band, under AA at 10.5px, and
      // was the header ink across PIMS long before the shared recipe existed.
      'color: var(--table-head-ink)',
      'position: sticky',
      'box-shadow: 0 1px 0 var(--hairline)',
    ]) {
      expect(th).toContain(decl);
      expect(shared).toContain(decl);
    }
  });
});
