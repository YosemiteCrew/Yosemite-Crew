import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { MerckAudience } from '@/app/features/integrations/services/types';
import { MerckReaderPortal } from './index';

/**
 * A real msdvetmanual.com deep link, because `isAllowedMerckUrl` is the gate the
 * page applies before it ever opens this overlay - a placeholder URL would draw a
 * reader the product could never reach. The framed document itself is MSD's, so
 * it will not render in an offline CI run; that is precisely the condition the
 * blocked story below covers.
 */
const READER_URL =
  'https://www.msdvetmanual.com/digestive-system/diseases-of-the-stomach-and-intestines-in-large-animals?media=hybrid';
const READER_TITLE = 'Diseases of the stomach and intestines in large animals';
const FOOTER_NOTICE = "Content © MSD Veterinary Manual · displayed under your clinic's integration";

type PortalProps = React.ComponentProps<typeof MerckReaderPortal>;

const baseArgs = {
  readerOpen: true,
  readerUrl: READER_URL,
  readerTitle: READER_TITLE,
  readerLoading: false,
  readerBlocked: false,
  audience: 'PROV' as MerckAudience,
  copied: null,
  onCopyUrl: fn(),
  setReaderOpen: fn(),
  setReaderLoading: fn(),
  setReaderBlocked: fn(),
} satisfies PortalProps;

/** The overlay's own root, portalled to `document.body`. */
const overlay = (): HTMLElement =>
  document.querySelector('[data-merck-reader-overlay="true"]') as HTMLElement;

/**
 * Held as a constant so the close story can assert it by exact string. A loose
 * regex would work here too, but the preview decorator drops an sr-only <h1>
 * reading "<title> - <story name>" into the same canvas, and exact strings are
 * the habit that keeps a text query from matching it instead.
 */
const BEHIND_COPY =
  'Search results behind the reader. The overlay is fixed inset-0 z-10000, so nothing here is ' +
  'reachable while it is open.';

/**
 * A page behind the overlay, so the `--sh55` scrim and the `backdrop-blur-sm`
 * have something to sit over. The reader is `fixed inset-0`, so this is
 * decoration for the eye rather than layout the component depends on.
 */
const Behind = () => (
  <div className="min-h-[560px] bg-[var(--screen)] p-6">
    <p className="text-[13px] text-[var(--ink-muted)]">{BEHIND_COPY}</p>
  </div>
);

/** Real state for the close button, so one story can exercise the dismissal. */
const ClosableReader = (props: PortalProps) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Behind />
      <MerckReaderPortal {...props} readerOpen={open} setReaderOpen={setOpen} />
    </>
  );
};

const meta = {
  title: 'Integrations/MerckReaderPortal',
  component: MerckReaderPortal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The full-screen MSD reader. It is the surface the whole MSD Manuals integration exists ' +
          'to deliver, and it had never been drawn - it only appears after a live search returns ' +
          'a result and the clinician opens one, from a page behind `ProtectedRoute` + ' +
          '`OrgGuard`.\n\n' +
          'It has **three internal states over one shell**, and only one of them is the manual. ' +
          '`readerBlocked` swaps the whole body for `MerckReaderFallback` and the iframe is not ' +
          'mounted at all; `readerLoading` keeps the iframe mounted and lays the branded loader ' +
          'over it; neither flag leaves the manual visible. The chrome - title, audience pill, ' +
          'copy-URL, open-in-new-tab, close, and the copyright footer - is identical in all ' +
          'three, which is what makes the differences easy to miss in review.\n\n' +
          'It `createPortal`s to `document.body`, so nothing it renders is inside `canvasElement`. ' +
          'Every query below goes through `within(document.body)` or the ' +
          '`[data-merck-reader-overlay]` root; a canvas-scoped query finds nothing and, worse, ' +
          'an absence check written that way passes whether the overlay is open or not.\n\n' +
          'The iframe carries `sandbox="allow-scripts allow-popups allow-forms allow-same-origin"`. ' +
          '`allow-same-origin` looks like the one to drop and is the one that must stay: MSD reads ' +
          '`document.cookie` on boot and throws in an opaque origin, which strands the frame on ' +
          "MSD's own loader forever. The attribute is asserted verbatim below so a well-meant " +
          'tightening shows up as a failed story rather than as a hung reader.',
      },
    },
  },
  tags: ['autodocs'],
  args: baseArgs,
  render: (args) => (
    <>
      <Behind />
      <MerckReaderPortal {...args} />
    </>
  ),
} satisfies Meta<typeof MerckReaderPortal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Loaded manual (iframe)',
  play: async () => {
    const body = within(document.body);
    const root = overlay();
    await expect(root).not.toBeNull();

    // Chrome: title, audience pill, and the three header controls.
    await expect(within(root).getByText(READER_TITLE)).toBeInTheDocument();
    await expect(within(root).getByText('PROFESSIONAL')).toBeInTheDocument();
    await expect(body.getByRole('button', { name: 'Copy manual URL' })).toBeInTheDocument();
    await expect(body.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute(
      'href',
      READER_URL
    );
    await expect(body.getByRole('button', { name: 'Close Merck reader' })).toBeInTheDocument();
    await expect(within(root).getByText(FOOTER_NOTICE)).toBeInTheDocument();

    /* The frame itself. Its CONTENT is MSD's and is not ours to assert, so the
       attributes are what this story protects - the src the page validated, the
       referrer policy, and the sandbox string whose `allow-same-origin` is
       load-bearing. */
    const frame = root.querySelector('iframe') as HTMLIFrameElement;
    await expect(frame).not.toBeNull();
    await expect(frame).toHaveAttribute('src', READER_URL);
    await expect(frame).toHaveAttribute('title', READER_TITLE);
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin');
    await expect(frame.getAttribute('sandbox')).toBe(
      'allow-scripts allow-popups allow-forms allow-same-origin'
    );

    // Neither of the two covering states is up.
    await expect(body.queryByTestId('merck-reader-loader')).not.toBeInTheDocument();
    await expect(body.queryByText('This manual didn’t load')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting reader. The panel is `size-full max-h-[95vh] max-w-7xl` over a `--sh55` ' +
          'scrim with a 4px blur, and the frame fills everything between the header band and the ' +
          'copyright footer.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Fetching from MSD',
  args: { readerLoading: true },
  play: async () => {
    const body = within(document.body);
    const root = overlay();

    const loader = body.getByTestId('merck-reader-loader');
    await expect(loader).toBeInTheDocument();
    await expect(loader).toHaveAttribute('aria-label', 'Loading Manual');
    // Curly quotes around the title, matching the component - a straight-quote
    // string here would miss and the story would report the loader absent.
    await expect(body.getByText(`Fetching “${READER_TITLE}” from MSD…`)).toBeInTheDocument();

    /* The iframe is STILL MOUNTED underneath. That is the whole design of this
       state - the loader is an overlay, not a replacement - and it is why
       `onLoad` can fire and clear the flag. A story that only checked the loader
       had appeared would look the same if the frame had been unmounted. */
    const frame = root.querySelector('iframe') as HTMLIFrameElement;
    await expect(frame).not.toBeNull();
    await expect(frame).toHaveAttribute('src', READER_URL);

    /* And it is COVERED, which is the property that makes this state readable.
       Taken off the frame's own previous sibling rather than off a `.absolute`
       ancestor lookup, so the node under test is the cover the component renders
       and not whichever wrapper happens to be positioned. Asserting its computed
       position would only restate the class it was selected by; the assertions
       that carry information are that it is exactly the frame's size and that it
       paints an opaque ground, because a transparent or half-height cover leaves
       MSD's half-drawn page showing through the spinner. */
    const cover = frame.previousElementSibling as HTMLElement;
    await expect(cover.contains(loader)).toBe(true);
    const coverRect = cover.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    await expect(Math.round(coverRect.width)).toBe(Math.round(frameRect.width));
    await expect(Math.round(coverRect.height)).toBe(Math.round(frameRect.height));
    await expect(Math.round(coverRect.top)).toBe(Math.round(frameRect.top));
    // Poll: the panel carries transitions, so a single synchronous read of a
    // colour can land on an interpolated value.
    await waitFor(() => {
      expect(getComputedStyle(cover).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });
    await expect(Number(getComputedStyle(cover).zIndex)).toBeGreaterThan(0);

    // Header chrome stays usable while the manual loads.
    await expect(body.getByRole('button', { name: 'Copy manual URL' })).toBeInTheDocument();
    await expect(body.getByRole('button', { name: 'Close Merck reader' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While the frame is in flight. A 12s timer runs alongside this state and flips it to ' +
          'the blocked card, because a stalled MSD page fires neither `onLoad` nor `onError` - ' +
          'so this state is bounded and never the last thing a user sees.',
      },
    },
  },
};

export const Blocked: Story = {
  name: 'Blocked / timed out',
  args: { readerBlocked: true },
  play: async () => {
    const body = within(document.body);
    const root = overlay();

    await expect(body.getByText('This manual didn’t load')).toBeInTheDocument();
    await expect(
      body.getByText(
        `MSD Veterinary Manual took too long to respond. Open “${READER_TITLE}” in a new tab to ` +
          'read the full content.'
      )
    ).toBeInTheDocument();

    /* The iframe is GONE, not hidden. `readerBlocked` picks the fallback instead
       of the fragment holding the frame, so there is no second request sitting
       behind this card retrying forever. */
    await expect(root.querySelector('iframe')).toBeNull();

    /* Two escape hatches to the same URL now: the header link and the fallback's
       own button. Both must survive, because this card is what a clinician is
       left with when framing is refused. */
    const links = body.getAllByRole('link', { name: 'Open in new tab' });
    await expect(links).toHaveLength(2);
    for (const link of links) {
      await expect(link).toHaveAttribute('href', READER_URL);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a refused frame or a 12s stall lands on. MSD sends `X-Frame-Options` on some ' +
          'pages, so this is not an edge case - it is the ordinary outcome for part of the ' +
          'catalog, and it is the state most likely to be seen in a CI snapshot.',
      },
    },
  },
};

export const PetParentAudience: Story = {
  name: 'Pet-parent audience pill',
  args: { audience: 'PAT' },
  play: async () => {
    const root = overlay();
    /* The audience is carried by ONE pill and nothing else in the shell changes,
       so the label is the entire difference between the two audiences - and the
       professional copy behind it is what must not be handed to a pet parent. */
    const pill = within(root).getByText('PET PARENT');
    await expect(pill).toBeVisible();
    await expect(within(root).queryByText('PROFESSIONAL')).not.toBeInTheDocument();

    /* "Nothing else changes" is the claim, so it gets asserted rather than
       described: the pill is the title row's last child, and the URL the frame
       is pointed at is the same one `PROV` would have been given. The audience
       chooses the wording MSD returns, not the document - so a build that swapped
       the frame along with the pill would be the bug this catches. */
    const titleRow = pill.parentElement as HTMLElement;
    await expect(titleRow.lastElementChild).toBe(pill);
    await expect(within(titleRow).getByText(READER_TITLE)).toBeVisible();
    await expect(root.querySelector('iframe')).toHaveAttribute('src', READER_URL);
  },
  parameters: {
    docs: {
      description: {
        story:
          '`PAT` swaps the pill to "PET PARENT" on `--blue-soft`; `PROV` reads "PROFESSIONAL" on ' +
          'the upcoming-status tokens. Same shell, same frame, one word of difference - which is ' +
          'why it is worth a story of its own.',
      },
    },
  },
};

export const CopiedState: Story = {
  name: 'Copy URL confirmed',
  args: { copied: READER_URL },
  play: async () => {
    const body = within(document.body);
    const root = overlay();
    // The label swaps IN PLACE rather than showing a toast, so "Copy manual URL"
    // must be gone, not merely joined by "Copied!" - and the confirmed button has
    // to still be the same node in the same header slot.
    const copied = body.getByRole('button', { name: 'Copied!' });
    await expect(copied).toBeVisible();
    await expect(body.queryByRole('button', { name: 'Copy manual URL' })).not.toBeInTheDocument();

    /* The action row is unchanged around it: copy, open-in-new-tab, close, in that
       order. A swap that rebuilt the row instead of the label would still satisfy
       the two checks above. */
    const actions = copied.parentElement as HTMLElement;
    await expect(actions.children).toHaveLength(3);
    await expect(actions.firstElementChild).toBe(copied);
    await expect(within(actions).getByRole('link', { name: 'Open in new tab' })).toHaveAttribute(
      'href',
      READER_URL
    );
    await expect(within(actions).getByRole('button', { name: 'Close Merck reader' })).toBeVisible();
    // The manual itself is untouched - copying a URL does not reload the frame.
    await expect(root.querySelector('iframe')).toHaveAttribute('src', READER_URL);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirmation is keyed on the URL, not on a boolean, so copying a different manual ' +
          "in the same session does not light up this one's button.",
      },
    },
  },
};

export const Closes: Story = {
  name: 'Closing removes the overlay',
  render: (args) => <ClosableReader {...args} />,
  play: async () => {
    const body = within(document.body);
    await expect(overlay()).not.toBeNull();

    await userEvent.click(body.getByRole('button', { name: 'Close Merck reader' }));

    /* `readerOpen` false returns `null` BEFORE the portal call, so the overlay is
       genuinely unmounted rather than left in the DOM without a flag the way a
       `<dialog>` would be. Asserting on the overlay root rather than on its text
       is what makes the difference visible. */
    await waitFor(() => expect(overlay()).toBeNull());
    await expect(body.queryByText(READER_TITLE)).not.toBeInTheDocument();

    /* The whole subtree goes with it, frame included - an overlay hidden rather
       than unmounted would leave MSD's page loading in the background, still
       running its scripts, for the rest of the session. The chrome is checked
       separately from the root because `readerOpen` guards the `return null`,
       while a future scrim-fade would be the change that leaves one behind. */
    await expect(
      body.queryByRole('button', { name: 'Close Merck reader' })
    ).not.toBeInTheDocument();
    await expect(body.queryByRole('link', { name: 'Open in new tab' })).not.toBeInTheDocument();
    // And the page underneath is back, not left behind a stranded scrim.
    await expect(body.getByText(BEHIND_COPY)).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The close button is the only dismissal the reader offers - there is no scrim click and ' +
          'no Escape handler, which is deliberate for a frame the user may have scrolled deep ' +
          'into.',
      },
    },
  },
};
