import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { guidesData } from '@/app/features/guides/data/guidesData';

import VideosCard from './VideosCard';

/** Same key the card writes when it is dismissed. */
const HIDDEN_STORAGE_KEY = 'yc_dashboard_videos_hidden';

const meta = {
  title: 'Cards/VideosCard',
  component: VideosCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dismissible dashboard banner that points a new clinic at the first three guide videos. ' +
          'The heading wraps while the "View more" button and close affordance stay on one line, and ' +
          'the three tiles sit in a 3-up grid that collapses to a single column below `md`. Tapping a ' +
          'tile opens the shared video player modal. Dismissing it writes to local storage and the ' +
          'card never renders again — every story clears that key first so it always appears.\n\n' +
          'The player is the half of this card that no capture has held. `VideoPlayerModal` is ' +
          'mounted unconditionally with `showModal={false}`, and `ModalBase` portals it to ' +
          '`document.body` as an `inert`, `opacity-0 pointer-events-none` `<dialog>` — so it is ' +
          'always in the DOM and never visible until a tile is clicked. Every dimension of the ' +
          'opened dialog (`sm:w-[720px] md:w-[860px] lg:w-[980px] max-w-[95vw]`), its centred ' +
          'title row, and the poster overlay that covers the video until `onLoadedData` fires ' +
          'existed only behind that click.\n\n' +
          'Which video it opens is also state: `handleOpenVideo` sets `activeVideo` **and** resets ' +
          '`isVideoLoaded` to false, so every tile re-enters the poster-covered state rather than ' +
          'inheriting the previous video’s. The stories below click a tile and assert the dialog ' +
          'carries that tile’s title, not merely that a dialog appeared.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    globalThis.localStorage?.removeItem(HIDDEN_STORAGE_KEY);
    return () => {
      globalThis.localStorage?.removeItem(HIDDEN_STORAGE_KEY);
    };
  },
} satisfies Meta<typeof VideosCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop reading: three tiles side by side under the heading row.',
      },
    },
  },
};

/**
 * `ModalBase` keeps the closed dialog mounted in the portal, so the `open`
 * attribute - not the presence of a dialog - is what separates the two states.
 */
const openDialog = () => document.querySelector('dialog[open]') as HTMLElement | null;

/**
 * The card previews the first three films of the generated library, so the
 * tiles are read from `guidesData` rather than named here: a regenerated
 * curriculum changes which films those are, not what the card does with them.
 */
const [FIRST_GUIDE, SECOND_GUIDE] = guidesData;

const findOpenDialog = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(openDialog()).toBeInTheDocument());
  return openDialog() as HTMLElement;
};

export const PlayerOpen: Story = {
  name: 'Player open (second tile)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: `Play video: ${SECOND_GUIDE.title}` })
    );

    // The dialog portals to document.body, so it is outside the story canvas.
    const dialog = await findOpenDialog();
    // Assert the dialog carries the clicked tile's content. A check that a
    // dialog opened would pass on an empty one, or on the wrong video.
    await expect(within(dialog).getByText(SECOND_GUIDE.title)).toBeInTheDocument();
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    const video = dialog.querySelector('video') as HTMLVideoElement;
    await expect(video).toHaveAttribute('aria-label', SECOND_GUIDE.title);
    // The dialog is wired to the tile that was clicked, not to the first video:
    // both the source and the poster come from the second guide entry.
    await expect(video).toHaveAttribute('poster', SECOND_GUIDE.thumbnailUrl);
    await expect(video.querySelector('source')).toHaveAttribute('src', SECOND_GUIDE.videoUrl);
    await expect(SECOND_GUIDE.videoUrl).not.toBe(FIRST_GUIDE.videoUrl);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tile-to-player path, and the check that it opens the *clicked* video: `activeVideo` ' +
          'drives both the `<source>` and the `<video poster>`, and a stale `activeVideo` would ' +
          'open the dialog looking correct with the wrong film in it. Whether the poster overlay ' +
          'is still up when you look depends on the network — it is gated on `onLoadedData`, so ' +
          'the reliable place to review that layer is the `Overlays/VideoPlayerModal` stories, ' +
          'which use a source that can never decode.',
      },
    },
  },
};

export const PlayerClosesBack: Story = {
  name: 'Player closes back to the card',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Play video: ${FIRST_GUIDE.title}` }));

    const dialog = await findOpenDialog();
    await expect(within(dialog).getByText(FIRST_GUIDE.title)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    // Closing returns the dialog to its inert node - the card is untouched, and
    // in particular is NOT dismissed: only the header Close does that.
    await expect(openDialog()).toBeNull();
    await expect(canvas.getAllByRole('button', { name: /^Play video:/ })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The round trip. `handleClose` on the modal resets `showModal` and `isVideoLoaded` ' +
          'together, so reopening any tile starts from the poster again. The card’s own Close - ' +
          'the one beside "View more" - is a different handler that writes ' +
          '`yc_dashboard_videos_hidden` and removes the card for good.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (single column)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below `md` the tiles stack and the thumbnails grow taller. The heading is the only element ' +
          'allowed to wrap: "View more" must stay on one line next to the close button.',
      },
    },
  },
};
