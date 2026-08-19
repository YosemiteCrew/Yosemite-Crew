import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { GuideVideo } from '@/app/features/guides/types/guides';

import GuidePlayerModal from './GuidePlayerModal';

const GUIDE: GuideVideo = {
  id: 'guide-checkin-flow',
  title: 'Checking a patient in and starting the encounter',
  description: 'From the day board to an open workspace, including the deposit prompt.',
  duration: '5:18',
  category: 'Front desk',
  tags: ['appointments', 'check-in'],
  videoUrl: 'https://example.invalid/guides/checkin.mp4',
  thumbnailUrl: 'https://example.invalid/guides/checkin.jpg',
  progressPercent: 62,
  currentTime: '3:07',
  chapters: [
    { label: 'Day board', time: '0:00' },
    { label: 'Check in', time: '1:12' },
    { label: 'Deposit', time: '3:40' },
    { label: 'Wrap up', time: '4:50', highlight: true },
  ],
};

const NEXT_GUIDE: GuideVideo = {
  id: 'guide-invoice-finalise',
  title: 'Finalising an invoice',
  description: 'Discounts, deposits and the tax footer.',
  duration: '4:02',
  category: 'Finance',
  tags: ['finance'],
  videoUrl: 'https://example.invalid/guides/invoice.mp4',
  thumbnailUrl: 'https://example.invalid/guides/invoice.jpg',
};

/**
 * The modal has no trigger of its own - the guides grid owns `showModal` and
 * decides which guide is loaded - so this harness supplies both, and gives the
 * stories something to click rather than posing the panel open from an arg.
 */
const GuideLauncher = (args: ComponentProps<typeof GuidePlayerModal>) => {
  const [showModal, setShowModal] = useState(args.showModal);
  return (
    <div className="flex min-h-[200px] items-start justify-center p-8">
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-full border border-[var(--hairline)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-body)]"
      >
        Play guide
      </button>
      <GuidePlayerModal {...args} showModal={showModal} setShowModal={setShowModal} />
    </div>
  );
};

/** Only `<dialog open>` is painted; a closed one stays mounted and inert. */
const openDialog = () => document.querySelector<HTMLElement>('dialog[open]');

const meta = {
  title: 'Overlays/GuidePlayerModal',
  component: GuidePlayerModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The centred guide player: a 920px panel holding a category pill and title, a Copy link ' +
          'chip, the 16:9 video surface with its scrubber and transport row, and a footer of ' +
          'chapter markers with a "Next" link.\n\n' +
          'The whole panel is doubly gated - it needs `showModal` **and** a non-null `guide`, and it ' +
          'returns `null` outright when the guide is missing rather than rendering an empty shell. ' +
          'So nothing about it had ever been drawn, and none of it is cheap: the video surface is ' +
          'the one place in the product that paints a hard-coded near-black `#1d1c1b` and a literal ' +
          '`#f7f3ec` ink instead of tokens, deliberately, because a video frame is dark in both ' +
          'themes. That decision is invisible unless the panel is on screen, and it is exactly the ' +
          'kind of thing a token sweep would "fix" by mistake.\n\n' +
          'A second state exists only as a consequence of a promise: the Copy link chip relabels to ' +
          '"Copied" only if `navigator.clipboard.writeText` resolves, and reverts itself after ' +
          '1800ms. `copyToClipboard` swallows a rejection and returns `false`, so a refused ' +
          'clipboard leaves the chip silently unchanged - there is no failure affordance at all. ' +
          'One story stubs the clipboard to reach the "Copied" label, because pressing the button ' +
          'against a real one is a coin toss.\n\n' +
          'The stories assert the opened panel has its content - the pill, the timecode, the ' +
          'scrubber width, the chapter labels - rather than that a dialog appeared, because an ' +
          'empty dialog satisfies the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    guide: GUIDE,
    nextGuide: NEXT_GUIDE,
    onNext: fn(),
  },
  render: (args) => <GuideLauncher {...args} />,
} satisfies Meta<typeof GuidePlayerModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Player open',
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play guide' }));

    const dialog = openDialog() as HTMLElement;
    await expect(dialog).toBeInTheDocument();

    // Header: category pill, title, the copy chip and the close chip.
    await expect(within(dialog).getByText('Front desk')).toBeInTheDocument();
    await expect(
      within(dialog).getByText('Checking a patient in and starting the encounter')
    ).toBeInTheDocument();
    await expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    // Video surface: a 16:9 block with the transport timecode inside it.
    const surface = dialog.querySelector('.aspect-video') as HTMLElement;
    await expect(surface).toBeTruthy();
    await expect(within(surface).getByText('3:07 / 5:18')).toBeInTheDocument();

    /* The scrubber is the only element whose geometry is data-driven. Assert the
       fill really carries the guide's progress - a dropped style leaves a
       full-width or zero-width bar that still looks like a scrubber. */
    const fill = surface.querySelector('span[style*="width"]') as HTMLElement;
    await expect(fill.style.width).toBe('62%');

    // Footer: chapter run and the next-guide link.
    await expect(within(dialog).getByText(/Chapters:/)).toBeInTheDocument();
    await expect(
      within(dialog).getByRole('button', { name: /Next: Finalising an invoice/ })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as a viewer sees it mid-way through a guide: a 62% scrubber, "3:07 / 5:18" in ' +
          'the transport row, and the final chapter tinted `--blue-text` while the rest stay ' +
          '`--ink-muted`.',
      },
    },
  },
};

export const CopiedLink: Story = {
  name: 'Copy link -> Copied',
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play guide' }));
    const dialog = openDialog() as HTMLElement;

    /* The chip only relabels if the clipboard write RESOLVES, and a real
       clipboard in an iframe may reject on permissions - which `copyToClipboard`
       swallows, leaving the chip unchanged and this story silently pointless.
       Shadow it with a resolving stub so the state is reached deterministically. */
    const writeText = fn(async () => undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    try {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }));
      expect(await within(dialog).findByText('Copied')).toBeInTheDocument();
      // The deep link is built from the guide id, not from the title or the route.
      await expect(writeText).toHaveBeenCalledWith(
        `${globalThis.window.location.origin}/guides?guide=guide-checkin-flow`
      );
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirmed-copy state. Note what it is not: there is no toast, no icon swap and no ' +
          'failure message - the word inside the chip is the entire feedback, and it reverts after ' +
          '1800ms. It also resets whenever the modal closes or the guide changes, via a ' +
          'prev-props comparison at render time rather than an effect.',
      },
    },
  },
};

export const NoChaptersOrNext: Story = {
  name: 'Last guide, no chapters',
  args: { guide: { ...GUIDE, chapters: undefined }, nextGuide: null },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play guide' }));
    const dialog = openDialog() as HTMLElement;

    // Both footer slots are conditional, so the footer keeps its padding and
    // renders empty rather than collapsing.
    await expect(within(dialog).queryByText(/Chapters:/)).toBeNull();
    await expect(within(dialog).queryByRole('button', { name: /^Next:/ })).toBeNull();
    // The header is still complete, so the panel does not look broken.
    await expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The last guide in a series, with no chapter markers. Both footer children are gated ' +
          'independently, so this render is a `px-5 pb-4 pt-3.5` band with nothing in it - the ' +
          'panel gets shorter but keeps a visible gap under the video.',
      },
    },
  },
};

export const AtStart: Story = {
  name: 'Not yet played',
  args: { guide: { ...GUIDE, progressPercent: undefined, currentTime: undefined } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play guide' }));
    const dialog = openDialog() as HTMLElement;
    const surface = dialog.querySelector('.aspect-video') as HTMLElement;

    // Both fields fall back rather than rendering "undefined": 0% and "0:00".
    await expect(within(surface).getByText('0:00 / 5:18')).toBeInTheDocument();
    const fill = surface.querySelector('span[style*="width"]') as HTMLElement;
    await expect(fill.style.width).toBe('0%');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A guide opened for the first time. The scrubber is clamped into 0-100 and the timecode ' +
          'defaults to "0:00", so an unwatched guide shows an empty bar rather than a missing one.',
      },
    },
  },
};

export const NoGuide: Story = {
  name: 'No guide loaded',
  args: { guide: null, showModal: true },
  play: async () => {
    // The component returns null before ModalBase is reached, so there is no
    // dialog in the DOM at all - not a dialog holding an empty panel.
    await expect(document.querySelector('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `showModal` true but no guide the component renders nothing. Worth pinning down: ' +
          'the guard sits above `ModalBase`, so the body scroll lock is never acquired either - a ' +
          'version that rendered the shell first would lock the page behind an invisible dialog.',
      },
    },
  },
};
