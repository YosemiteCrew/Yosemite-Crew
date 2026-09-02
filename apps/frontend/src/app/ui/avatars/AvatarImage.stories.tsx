import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AvatarImage from './AvatarImage';
import CompanionAvatar from './CompanionAvatar';

/** Served from our own CDN, the same host every real companion photo lives on. */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/dog.png';
/**
 * `.invalid` is reserved (RFC 2606) and never resolves, so the request fails at
 * DNS without touching the network - the offline guard does not cover `<img>`
 * loads, and this is the one broken-photo URL that needs no stub to stay broken.
 */
const DEAD_PHOTO = 'https://example.invalid/missing.png';

const meta = {
  title: 'Avatars/AvatarImage',
  component: AvatarImage,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The photo half of every avatar in the product. `next/image` has no failure state: a ' +
          'photo URL that stopped resolving (a deleted S3 object, a rotated CDN path) leaves an ' +
          'alt-less `<img>` as a blank disc in every table that shows it. This wrapper listens for ' +
          '`onError` and swaps in the caller-supplied `fallback` - the initials disc the design rule ' +
          'makes mandatory - and reaches that fallback synchronously when `src` is empty. The ' +
          'fallback is a required prop on purpose: a call site cannot forget it and ship an empty ' +
          'circle.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'range', min: 24, max: 96, step: 2 } },
    src: { control: 'text' },
    fallback: { control: false },
  },
  args: {
    src: CDN_PHOTO,
    alt: 'Bella',
    size: 46,
    className: 'shrink-0 rounded-full object-cover shadow-[0_0_0_1px_var(--hairline-soft)]',
    style: { width: 46, height: 46 },
    fallback: <CompanionAvatar name="Bella" size={46} textClassName="text-[20px]" alt="Bella" />,
  },
} satisfies Meta<typeof AvatarImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The photo resolves: the image is on screen and the monogram never renders. */
export const PhotoLoads: Story = {
  name: 'Photo loads',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const img = canvas.getByRole('img', { name: 'Bella' });
    // Intrinsic width/height come off `size`; without them next/image reserves
    // the wrong box and the row reflows once the file lands.
    await expect(img).toHaveAttribute('width', '46');
    await expect(img).toHaveAttribute('height', '46');
    await expect(decodeURIComponent(img.getAttribute('src') ?? '')).toContain('avatar/dog.png');
    // Asserting the monogram is ABSENT is the half that matters: a wrapper that
    // always showed initials would still look fine in this story.
    await expect(canvas.queryByText('B')).toBeNull();
  },
};

/**
 * The photo URL no longer resolves. The `<img>` errors, and the monogram takes
 * its place - this is the exact state the design rule forbids as an empty circle.
 */
export const BrokenPhoto: Story = {
  name: 'Broken photo',
  args: { src: DEAD_PHOTO },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The swap happens after the browser gives up on the request, so it is
    // awaited rather than read synchronously.
    const monogram = await canvas.findByText('B', {}, { timeout: 8000 });
    await expect(monogram).toBeVisible();
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};

/** No photo at all: the fallback renders synchronously, no request is made. */
export const EmptySource: Story = {
  name: 'Empty source',
  args: { src: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('B')).toBeVisible();
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};
