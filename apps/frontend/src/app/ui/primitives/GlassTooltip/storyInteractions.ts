/**
 * Opening a `GlassTooltip` from a Storybook play function, reliably.
 *
 * The component binds `mouseenter` / `focusin` natively, inside an effect, to its own
 * wrapper span. Storybook starts a play function before that effect has flushed, so a
 * single dispatch at the start of a play lands on an element that has no listener yet
 * and does nothing at all. Measured in a probe story: the events reached the wrapper,
 * the tooltip never opened, and it was still closed 350ms later. The same hover after a
 * 100ms wait opened it; a redispatch loop needed three attempts.
 *
 * That is how a tooltip story stays green while proving nothing - the bubble is queried
 * with `findByRole`, which retries the QUERY but never re-sends the event, so a missed
 * dispatch is permanent. Every one of the 38 tooltip stories in this Storybook failed
 * this way, undetected, because no CI job executes play functions.
 *
 * Plain DOM events rather than `userEvent`: the dispatch has to be re-sendable and
 * synchronous inside the poll. `userEvent.hover` does reach the wrapper - it walks the
 * pointer-enter path across ancestors, which the probe confirmed - but a raw
 * `dispatchEvent` does not, because `mouseenter` never bubbles. Hence the wrapper, not
 * the control inside it, is the target here.
 */
const TIMEOUT_MS = 2000;
const STEP_MS = 25;

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The span carrying the listeners, given either it or anything inside it. */
export const glassTooltipWrapper = (el: HTMLElement): HTMLElement => {
  const wrapper = el.closest('.glass-tooltip');
  if (!wrapper) {
    throw new Error(
      `No .glass-tooltip ancestor for <${el.tagName.toLowerCase()}>. The control is not ` +
        'wrapped in a GlassTooltip, so no bubble can open.'
    );
  }
  return wrapper as HTMLElement;
};

const bubbles = () => [...document.querySelectorAll('[role="tooltip"]')] as HTMLElement[];

/**
 * Opens the bubble for `trigger` and resolves with it. Pass the control or the wrapper;
 * either works.
 */
export const openGlassTooltip = async (
  trigger: HTMLElement,
  { via = 'hover' }: { via?: 'hover' | 'focus' } = {}
): Promise<HTMLElement> => {
  const wrapper = glassTooltipWrapper(trigger);
  const event = () =>
    via === 'hover'
      ? new MouseEvent('mouseenter', { bubbles: false })
      : new FocusEvent('focusin', { bubbles: true });

  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  for (;;) {
    wrapper.dispatchEvent(event());
    attempts += 1;
    await wait(STEP_MS);
    const open = bubbles();
    if (open.length > 0) return open[open.length - 1];
    if (Date.now() > deadline) {
      throw new Error(
        `No tooltip opened after ${attempts} ${via} dispatch(es) over ${TIMEOUT_MS}ms. ` +
          'The trigger has a .glass-tooltip wrapper but nothing listened to it.'
      );
    }
  }
};

/**
 * Closes it again and resolves once no bubble remains.
 *
 * Worth doing explicitly in any story that opens more than one: the bubble is portalled
 * to `document.body`, so a stale one is outside `canvasElement` and a later
 * `getAllByRole('tooltip')` count silently includes it.
 */
export const closeGlassTooltip = async (trigger: HTMLElement): Promise<void> => {
  const wrapper = glassTooltipWrapper(trigger);
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    wrapper.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    wrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await wait(STEP_MS);
    if (bubbles().length === 0) return;
    if (Date.now() > deadline) {
      throw new Error(`A tooltip was still open ${TIMEOUT_MS}ms after leaving the trigger.`);
    }
  }
};
