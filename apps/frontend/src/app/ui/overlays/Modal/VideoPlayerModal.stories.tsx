import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import VideoPlayerModal from './VideoPlayerModal';

/**
 * An inline SVG poster and a deliberately undecodable video source, so the story
 * makes no network request and the "still loading" branch is stable: `onLoadedData`
 * can never fire, which is the state the poster overlay exists for.
 */
const POSTER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">' +
    '<rect width="960" height="540" fill="#1d2b3a"/>' +
    '<circle cx="480" cy="270" r="64" fill="#ffffff" opacity="0.9"/>' +
    '<polygon points="460,238 460,302 516,270" fill="#1d2b3a"/>' +
    '</svg>'
)}`;

const UNDECODABLE_MP4 = 'data:video/mp4;base64,AAAAAA==';

const VIDEO = {
  title: 'Run a visit end to end',
  videoUrl: UNDECODABLE_MP4,
  thumbnailUrl: POSTER,
};

type ModalProps = ComponentProps<typeof VideoPlayerModal>;

type HarnessProps = Omit<
  ModalProps,
  'showModal' | 'setShowModal' | 'isVideoLoaded' | 'setIsVideoLoaded'
> & {
  /** Start the dialog with the poster overlay already dismissed. */
  videoLoaded?: boolean;
};

/**
 * `showModal` and `isVideoLoaded` live in the card that opens this dialog, so
 * without a holder the modal can only ever be rendered inert. A trigger keeps
 * the docs page from stacking several open dialogs on top of each other.
 */
const VideoPlayerModalHarness = ({ activeVideo, videoLoaded = false }: HarnessProps) => {
  const [showModal, setShowModal] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(videoLoaded);

  return (
    <div className="flex min-h-[160px] items-center justify-center">
      <button
        type="button"
        className="rounded-2xl bg-text-primary px-6 py-3 text-body-3-emphasis text-[var(--screen)]"
        onClick={() => {
          setIsVideoLoaded(videoLoaded);
          setShowModal(true);
        }}
      >
        Play video
      </button>
      <VideoPlayerModal
        showModal={showModal}
        setShowModal={setShowModal}
        activeVideo={activeVideo}
        isVideoLoaded={isVideoLoaded}
        setIsVideoLoaded={setIsVideoLoaded}
      />
    </div>
  );
};

/**
 * Matched on the `open` attribute rather than on `role`: `ModalBase` leaves the
 * closed dialog mounted in the portal, so "is there a dialog" is always true and
 * only `open` distinguishes the two states.
 */
const openDialog = () => document.querySelector('dialog[open]') as HTMLElement | null;

const findOpenDialog = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(openDialog()).toBeInTheDocument());
  return openDialog() as HTMLElement;
};

const meta = {
  title: 'Overlays/VideoPlayerModal',
  component: VideoPlayerModalHarness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The shared guide-video dialog, opened from the dashboard videos strip and from the ' +
          'Guides screen. A `CenterModal` widened to `sm:w-[720px] md:w-[860px] lg:w-[980px] ' +
          'max-w-[95vw]`, holding a centred title row with an absolutely-positioned Close on the ' +
          'right, and a `rounded-2xl border-card-border overflow-hidden` video frame.\n\n' +
          'None of that had ever been drawn. `ModalBase` portals the dialog to `document.body` ' +
          'and leaves it `inert` with `opacity-0 pointer-events-none` until `showModal` flips, and ' +
          '`showModal` plus a non-null `activeVideo` both live in the parent - so the closed ' +
          'component contributes an invisible, unstyled node and nothing else.\n\n' +
          'The state most worth seeing is the one nobody screenshots: the **unloaded poster**. ' +
          'The thumbnail is painted twice by two different mechanisms - the `<video poster>` ' +
          'attribute, which the browser drops as soon as it has a frame, and an ' +
          '`absolute inset-0 bg-cover` overlay gated on `isVideoLoaded === false`, which only ' +
          'goes away when `onLoadedData` fires. Every viewer sees the second one first, and it is ' +
          'the layer that has to line up with the frame’s `rounded-2xl` clip. If the video never ' +
          'loads - offline, a dead URL - it is also the *only* thing they ever see.\n\n' +
          'There is a third rendering behind `activeVideo === null`: the title falls back to the ' +
          'literal string "Video" and the frame becomes a bare `aspect-video bg-black/80` block ' +
          'with no `<video>` element at all. All three are drawn below.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeVideo: VIDEO,
  },
} satisfies Meta<typeof VideoPlayerModalHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PosterOverlay: Story = {
  name: 'Open, poster still covering the video',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));

    // The dialog portals to document.body, outside the story canvas.
    const dialog = await findOpenDialog();
    await expect(within(dialog).getByText('Run a visit end to end')).toBeInTheDocument();
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    // Assert the frame really holds both layers, rather than that a flag flipped.
    const video = dialog.querySelector('video') as HTMLVideoElement;
    await expect(video).toBeInTheDocument();
    await expect(video).toHaveAttribute('poster', POSTER);
    const frame = video.parentElement as HTMLElement;
    await expect(frame.children).toHaveLength(2);
    const overlay = frame.lastElementChild as HTMLElement;
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
    await expect(overlay.style.backgroundImage).toContain('data:image/svg+xml');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What every viewer sees on open: the overlay sitting on top of the `<video>`, inside ' +
          'the same `overflow-hidden` rounded frame. The player controls are underneath it and ' +
          'unreachable until the first frame decodes - so if the source 404s this is a still ' +
          'image with no visible affordance and no error, which is precisely why it wants a story.',
      },
    },
  },
};

export const Loaded: Story = {
  name: 'Open, video loaded',
  args: { videoLoaded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));

    const dialog = await findOpenDialog();
    const video = dialog.querySelector('video') as HTMLVideoElement;
    const frame = video.parentElement as HTMLElement;
    // The overlay is unmounted, not faded: the frame is down to the video alone.
    await expect(frame.children).toHaveLength(1);
    await expect(video).toHaveAttribute('controls');
    // The video keeps its own accessible name and a captions track.
    await expect(video).toHaveAttribute('aria-label', 'Run a visit end to end');
    await expect(video.querySelector('track')).toHaveAttribute('kind', 'captions');
  },
  parameters: {
    docs: {
      description: {
        story:
          'After `onLoadedData`. The native controls become reachable and the frame is one layer ' +
          'deep. Worth seeing beside the poster state: the two differ only in a child that ' +
          'covers the whole frame, so a mis-ordered or mis-sized overlay is invisible in either ' +
          'one alone.',
      },
    },
  },
};

export const NoActiveVideo: Story = {
  name: 'Open with no video selected',
  args: { activeVideo: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));

    const dialog = await findOpenDialog();
    // Fallback title, no <video>, and the placeholder block instead of the frame's contents.
    await expect(within(dialog).getByText('Video')).toBeInTheDocument();
    await expect(dialog.querySelector('video')).not.toBeInTheDocument();
    await expect(dialog.querySelector('.aspect-video')).toBeInTheDocument();
    // Close is still the only control, so the dialog is never a dead end.
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The guard branch. With `activeVideo` null the dialog still opens at its full ' +
          '720/860/980px width and shows a black `aspect-video` panel under the word "Video" - a ' +
          'state reachable in production if `showModal` is set before the selection is, and one ' +
          'no snapshot has contained.',
      },
    },
  },
};

export const Closed: Story = {
  name: 'Closed (inert node)',
  play: async () => {
    // Nothing to click: this documents that the closed component is not "absent"
    // but a portalled, inert, transparent dialog already in document.body.
    await expect(openDialog()).toBeNull();
    const dialog = document.querySelector('dialog.yc-modal-dialog');
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAttribute('inert');
    await expect(dialog).toHaveClass('pointer-events-none');
    // The <video> and its preload="metadata" request are already in the DOM.
    await expect(dialog?.querySelector('video')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. `ModalBase` always portals the `<dialog>`, marking it `inert` and ' +
          'giving the container `opacity-0 pointer-events-none` rather than unmounting it - so the ' +
          'video element and its `preload="metadata"` request exist before anyone opens anything, ' +
          'which is what the last assertion checks. The `<dialog>` also carries no `open` ' +
          'attribute and no `aria-modal`, so nothing behind it is trapped.',
      },
    },
  },
};
