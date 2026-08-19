import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import ImageUploadField from './ImageUploadField';

const ORG_ID = 'org-storybook-inventory';

/** A real object on the shared asset CDN, so the filled story shows actual pixels. */
const CDN_IMAGE = MEDIA_SOURCES.avatars.dog;

/** What the field actually stores once an upload finishes: the bare S3 key. */
const STORED_KEY = 'inventory/items/meloxicam-15mgml.jpg';

const ORG_CDN_PREFIX = 'https://d2kyjiikho62xx.cloudfront.net/';

/**
 * `value` is owned by the form, so the harness holds it - that is what lets the
 * Remove control actually clear the field instead of firing into a spy.
 */
const Field = ({
  initialValue = '',
  organisationId,
}: {
  initialValue?: string;
  organisationId?: string;
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="w-[420px] max-w-full bg-[var(--screen)] p-4">
      <ImageUploadField
        label="Product image (optional)"
        value={value}
        organisationId={organisationId}
        onChange={setValue}
      />
    </div>
  );
};

const fileInput = (canvasElement: HTMLElement): HTMLInputElement =>
  canvasElement.querySelector('input[type="file"]') as HTMLInputElement;

const pngFile = () => new File(['not-a-real-png'], 'meloxicam.png', { type: 'image/png' });

const meta = {
  title: 'Inventory/ImageUploadField',
  component: Field,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The product-image field in the Add product drawer. Only its empty state had ever ' +
          'been reachable: everything after a file is chosen lives behind internal state with ' +
          'no prop behind it.\n\n' +
          'The field has four shapes. **Empty** is a 140px hairline-bordered drop button with ' +
          'a cloud glyph. **Filled** is a 140px `object-cover` frame with a round remove ' +
          'control at the top right. **Uploading** is that same frame over a local `blob:` ' +
          'preview with a `--neutral-0/60` scrim and the remove control withdrawn, so nothing ' +
          'can be removed mid-flight. **Error** adds a `text-caption-1` (14px) ' +
          '`--text-error` line under the frame - the same size as the label above it, and two ' +
          'points larger than the 12px every other field error in the drawer uses, so it is ' +
          'worth deciding which of the two is the intended house size.\n\n' +
          'Two details are only visible with the stories side by side. The value the field ' +
          'holds is an **S3 key**, not a URL - `getSafeOrgImageUrl` expands it onto the org ' +
          'CDN on every render, and rejects anything that is neither a key nor an https URL - ' +
          'so a story that passes a ready-made URL is testing a different code path from the ' +
          'one the form uses. And the placeholder carries its own `Uploading…` label that can ' +
          'never render, because a blob preview is always set before `isUploading` is, which ' +
          'always makes `displayUrl` non-empty; it is annotated as unreachable in the source ' +
          'rather than removed.',
      },
    },
  },
  tags: ['autodocs'],
  args: { initialValue: '', organisationId: ORG_ID },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Empty',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const placeholder = canvas.getByText('Upload image').closest('button') as HTMLElement;
    await expect(placeholder).toBeEnabled();
    await expect(within(placeholder).getByText('PNG, JPG, WebP · Max 2 MB')).toBeInTheDocument();
    // The 140px drop target the filled frame has to match, on the border box.
    await expect(placeholder.getBoundingClientRect().height).toBeGreaterThanOrEqual(140);

    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    /* The copy promises PNG/JPG/WebP and 2 MB. Only the first half is enforced, and
       only by the picker: `accept` is asserted here because it is the whole of the
       client-side guard, and there is no size check anywhere in the component - the
       "Max 2 MB" half of that line is a claim the field does not keep. */
    const input = fileInput(canvasElement);
    await expect(input.accept).toBe('image/png,image/jpeg,image/webp');
    await expect(input).toHaveAttribute('aria-label', 'Product image (optional)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only state anything could previously draw. The native file input is hidden and ' +
          'the visible control is a button that clicks it by id, so the picker opens from a ' +
          'styled 140px target rather than from a browser-chrome "Choose file".',
      },
    },
  },
};

export const Filled: Story = {
  name: 'Filled',
  args: { initialValue: CDN_IMAGE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const image = canvas.getByRole('img', { name: 'Product image' });
    await expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(CDN_IMAGE);
    // The frame crops rather than letterboxes: 140px tall, full width, object-cover.
    await expect(image.getBoundingClientRect().height).toBeCloseTo(140, 0);
    await expect(getComputedStyle(image).objectFit).toBe('cover');

    // The remove control only exists when nothing is in flight.
    const remove = canvas.getByRole('button', { name: 'Remove image' });
    await expect(canvas.queryByText('Uploading…')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Upload image')).not.toBeInTheDocument();

    await userEvent.click(remove);

    /* Removing calls `onChange('')`, and the harness owns `value`, so this asserts
       the field really returned to empty rather than that a spy was called. */
    await waitFor(() => expect(canvas.getByText('Upload image')).toBeInTheDocument());
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An image already on the product. The remove control is a 28px circle on a ' +
          '`--neutral-0/90` disc, floated over the top-right of the frame rather than placed ' +
          'below it, so it overlaps whatever the picture happens to be - worth checking ' +
          'against a light-topped photo.',
      },
    },
  },
};

export const FilledFromStoredKey: Story = {
  name: 'Filled from a stored S3 key',
  args: { initialValue: STORED_KEY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The contract that matters: what the form stores is a key, and the field turns
       it into an org-CDN URL on every render. Asserting the expansion is the point of
       this story - the object itself is a placeholder path, so the frame draws empty. */
    const image = canvas.getByRole('img', { name: 'Product image' });
    await expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(
      `${ORG_CDN_PREFIX}${STORED_KEY}`
    );
    await expect(canvas.getByRole('button', { name: 'Remove image' })).toBeInTheDocument();
    await expect(canvas.queryByText('Upload image')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a saved product actually renders. `onChange` is called with the S3 key the ' +
          'presign step returns, so this - not a ready-made https URL - is the value the field ' +
          "holds for the rest of the form's life.\n\n" +
          'The path here points at no real object, so the frame is an empty 140px box with a ' +
          'remove control on it. That is also exactly what a live product with a deleted or ' +
          'mistyped key looks like: there is no broken-image or retry affordance.',
      },
    },
  },
};

export const OrganisationNotLoaded: Story = {
  name: 'Error: organisation not loaded',
  args: { organisationId: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.upload(fileInput(canvasElement), pngFile());

    // The guard runs before any preview is made, so the frame never appears: the
    // placeholder stays and an error line is added under it.
    // The query is awaited on its own line; double-awaiting a findBy inside an
    // assertion fails the PR gate.
    const message = await canvas.findByText('Organisation not loaded. Please try again.');
    await expect(message).toBeVisible();
    /* The size is the point of the error line, not its presence. It is
       `text-caption-1`, which is 14px - the same size as this field's own label, and
       two points larger than the `text-caption-2` (12px) every other field error in
       this drawer uses. */
    await expect(getComputedStyle(message).fontSize).toBe('14px');

    // The placeholder is untouched: no frame, no preview, no in-flight copy.
    await expect(canvas.getByText('Upload image')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Uploading…')).not.toBeInTheDocument();
    // The picker was cleared, so a retry starts from an empty input.
    await expect(fileInput(canvasElement).value).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one failure the field can reach without the network, and a real one: the drawer ' +
          'renders before the org store settles, so a fast picker click lands here. The error ' +
          'is a 14px line under a placeholder that looks untouched, and the input has already ' +
          'been cleared, so the next attempt starts from scratch with no hint that retrying is ' +
          'what to do.',
      },
    },
  },
};

export const UploadInFlight: Story = {
  name: 'Uploading, then failing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.upload(fileInput(canvasElement), pngFile());

    /* The in-flight frame, asserted synchronously rather than through `findBy`.
       `handleFileChange` sets the blob preview and `isUploading` BEFORE its first
       await, and the await is a real XHR - which cannot settle inside the microtask
       flush `userEvent` performs - so this state is committed and still standing here.
       A retrying query would be no safer: if the state had already passed, no amount
       of polling brings it back. */
    const image = canvas.getByRole('img', { name: 'Product image' });
    await expect(image.getAttribute('src')?.startsWith('blob:')).toBe(true);
    await expect(canvas.getByText('Uploading…')).toBeInTheDocument();
    // Removal is withdrawn mid-flight, so nothing can be cleared while a PUT is out.
    await expect(canvas.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

    /* Then it settles. There is no stub for the presigned-URL call in this repo, so
       the terminal state here is the failure one; the generous timeout is because a
       real request is being waited on rather than a state machine. */
    await waitFor(() => expect(canvas.queryByText('Uploading…')).not.toBeInTheDocument(), {
      timeout: 15000,
    });
    await expect(canvas.getByText('Upload failed. Please try again.')).toBeInTheDocument();
    await expect(canvas.getByText('Upload image')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole post-selection sequence in one story, because the two halves cannot be ' +
          'separated without a request stub - and this repo has no MSW or module-mock wiring.\n\n' +
          'The in-flight half is the one nothing had drawn: the local `blob:` preview goes up ' +
          'immediately, so the frame is filled with the real picture before a byte has left, ' +
          'and the scrim plus the withdrawn remove control are the only thing saying it is not ' +
          'saved yet. If that upload then fails, the picture is revoked and thrown away and ' +
          'the field drops back to the empty placeholder with one line of red under it - the ' +
          'chosen file is gone and has to be picked again. Worth deciding whether a failed ' +
          'upload should keep the preview and offer a retry.',
      },
    },
  },
};
