/**
 * The class recipes both public booking pages share.
 *
 * A plain `.ts` module rather than exports beside the components: a file that
 * exports both components and non-components cannot preserve state across a
 * Fast Refresh, so React Doctor's `only-export-components` is right to flag it.
 *
 * On the trailing `!` in some of the strings below - none of them is
 * decorative. `globals.css` declares its own `@layer` blocks and everything
 * between them is unlayered. For normal declarations an unlayered rule beats a
 * layered one whatever the specificity, so a plain Tailwind utility loses to
 * any unlayered rule setting the same property; for important declarations the
 * order reverses. Each `!` is named at the site that needs it.
 */

/**
 * Every text field, textarea and the date input.
 *
 * The focus indicator is a box-shadow, not an outline, and that is forced:
 * `input:focus-visible { outline: none }` is unlayered, so no `outline-*`
 * utility can ever beat it. The old recipe also set `outline-none` itself,
 * which was redundant against that rule and actively harmful - `outline` is the
 * one property forced-colors mode preserves.
 */
export const FIELD =
  'w-full min-h-12 rounded-xl border-[1.5px] border-[var(--ink-6b)] bg-[var(--field-bg)] ' +
  'px-4 py-3 text-body-4 text-[var(--ink-body)] placeholder:text-[var(--ink-muted)] ' +
  'transition-[border-color,box-shadow] duration-150 ease-out ' +
  'hover:border-[var(--ink)] ' +
  'focus-visible:border-[var(--color-input-border-active)] ' +
  'focus-visible:shadow-[0_0_0_3px_var(--glow-b26)]';

/**
 * Time slots and quick-day chips.
 *
 * Selection is a fill, not a border-colour swap. The old recipe changed only
 * the border, which is a 3.01:1 delta in light and 2.88:1 in dark - and it was
 * written as an inline `style` object, which is why the page had no hover,
 * focus or active state anywhere: a style attribute has no pseudo-classes.
 *
 * Tailwind's `aria-pressed:` variant compiles to `[aria-pressed="true"]`, so
 * React still renders the literal "false" the tests read.
 */
export const PILL =
  'flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-[var(--ink-6b)] ' +
  'bg-[var(--field-bg)] px-2 text-body-4-emphasis tabular-nums text-[var(--ink)] ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out ' +
  'hover:border-[var(--blue-strong)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue-text)] ' +
  'active:translate-y-px ' +
  'aria-pressed:border-[var(--blue-strong)] aria-pressed:bg-[var(--blue-strong)] ' +
  'aria-pressed:text-[var(--white-text)] aria-pressed:shadow-[0_6px_16px_var(--glow-b26)]';

/**
 * The time grid, sized by its content rather than by breakpoints.
 *
 * auto-fill with a 4.5rem floor gives three columns on a 320px phone, four on a
 * 390px one and six on the desktop card, without a single breakpoint prefix and
 * without ever dropping a pill under the 44px target. A fixed `grid-cols-3`
 * made a 27-slot day nine rows deep on a phone, which is most of why the
 * redesign was running longer than the page it replaced.
 */
export const SLOT_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2';

/** Section eyebrows. `font-bold` and the tracking are utilities, so they beat
 *  .text-caption-2's own weight and tracking in @layer components. */
export const EYEBROW =
  'mb-4 block text-caption-2 font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]';

/** The label above a field. Named because six fields share it, and Sonar
 *  counts a class string repeated three times as a duplicated literal. */
export const FIELD_LABEL = 'mb-2 block text-caption-1 text-[var(--ink-body)]';

/** Quiet supporting copy: hints, the status line, footnotes. */
export const META_TEXT = 'text-caption-1 text-[var(--ink-muted)]';

/** Body copy in a centred state card, measured for a comfortable line length. */
export const STATE_BODY = 'max-w-[46ch] text-body-4 text-[var(--ink-body)]';
