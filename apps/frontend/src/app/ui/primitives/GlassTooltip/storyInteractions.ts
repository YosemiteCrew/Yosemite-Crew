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
 *
 * Bubbles are matched by IDENTITY, not by presence. Every bubble portals to
 * `document.body` with nothing tying it to its trigger, so "is a tooltip open?" cannot
 * answer "did THIS one open?" - and a stale bubble left by an earlier interaction would
 * satisfy a presence check instantly, returning success without ever opening the
 * trigger under test. That is the same class of silent pass this helper exists to
 * remove, so `open` waits for a node that was NOT there when it started, and `close`
 * waits for the node it actually opened to leave the document.
 */
const TIMEOUT_MS = 2000;
const STEP_MS = 25;

/** Wrapper -> the bubble `openGlassTooltip` saw it open, so `close` can wait for that one. */
const openedBubbles = new WeakMap<HTMLElement, HTMLElement>();

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

  // Anything already open belongs to someone else and can never count as success.
  const stale = new Set(bubbles());
  const deadline = Date.now() + TIMEOUT_MS;
  let attempts = 0;
  for (;;) {
    wrapper.dispatchEvent(event());
    attempts += 1;
    await wait(STEP_MS);
    const opened = bubbles().find((bubble) => !stale.has(bubble));
    if (opened) {
      openedBubbles.set(wrapper, opened);
      return opened;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `No tooltip opened after ${attempts} ${via} dispatch(es) over ${TIMEOUT_MS}ms` +
          (stale.size > 0
            ? `. ${stale.size} unrelated bubble(s) were already open - close them first, ` +
              'since a leftover bubble cannot stand in for this trigger.'
            : '. The trigger has a .glass-tooltip wrapper but nothing listened to it.')
      );
    }
  }
};

/**
 * Closes the bubble this trigger opened, and resolves once it has left the document.
 *
 * Worth doing explicitly in any story that opens more than one: a dispatched
 * `mouseenter` on the next control emits no `mouseleave` on the last, so bubbles
 * accumulate on `document.body` - outside `canvasElement`, where a later
 * `getAllByRole('tooltip')` count silently includes them.
 */
export const closeGlassTooltip = async (trigger: HTMLElement): Promise<void> => {
  const wrapper = glassTooltipWrapper(trigger);
  // Waiting on "no bubbles at all" would hang on someone else's; wait on ours.
  const target = openedBubbles.get(wrapper);
  const gone = () => (target ? !document.contains(target) : bubbles().length === 0);

  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    wrapper.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    wrapper.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await wait(STEP_MS);
    if (gone()) {
      openedBubbles.delete(wrapper);
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`A tooltip was still open ${TIMEOUT_MS}ms after leaving the trigger.`);
    }
  }
};
