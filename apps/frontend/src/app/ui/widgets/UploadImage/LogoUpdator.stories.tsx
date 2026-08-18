import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

import LogoUpdator from './LogoUpdator';

/** Built lazily inside a play so no `File` is constructed while the CSF module is analysed. */
const makeFile = (name: string, type: string) =>
  new File([new Blob(['fixture'], { type })], name, { type });

/** Only `<dialog open>` is painted; the closed one stays mounted and inert. */
const openTheModal = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Update logo' }));
  const dialog = document.querySelector<HTMLElement>('dialog[open]');
  if (!dialog) throw new Error('The Update logo modal did not open');
  return dialog;
};

const meta = {
  title: 'Widgets/UploadImage/LogoUpdator',
  component: LogoUpdator,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The 40px avatar chip that lets an organisation replace its logo, and the confirmation ' +
          'modal behind it.\n\n' +
          'Only the chip had ever been drawn. Everything else - the whole modal - lives behind a ' +
          'click, and it is not a small surface: a 100px "before" avatar, an arrow, and a 100px ' +
          'circular file well that swaps its camera glyph for a `blob:` preview once a file is ' +
          'accepted, over a two-column Cancel/Update pair.\n\n' +
          'It is also a `CenterModal`, so it `createPortal`s to `document.body`. The closed modal ' +
          'stays mounted as an `inert` `<dialog>` without `open`, which means a plain text query ' +
          'finds its contents whether or not it is visible - the assertions here filter on ' +
          '`dialog[open]` for that reason, and a story asserting the title merely exists would pass ' +
          'on a modal that never opened.\n\n' +
          'Two states inside it can only be reached through the file input, which is `display: ' +
          'none` behind its label. The preview branch replaces the camera glyph with an `<img>` and ' +
          "simultaneously drops the well's border (`border-0` vs `border`), so the ring around it " +
          'disappears - a swap no resting render contains. The rejection branch is validated ' +
          'locally against a PNG/JPEG/WEBP allow-list, before any signed-URL request, and prints a ' +
          'red line under the well. The stories stop there: pressing Update issues a signed-URL ' +
          'POST and a PUT to S3.\n\n' +
          'The action pair is a `grid grid-cols-2` that mounts only with the dialog - the same shape ' +
          'as the popover bug this work exists to catch, where an invalid template is dropped by ' +
          'the browser and the children silently collapse into one column - so the open story ' +
          'asserts the computed template really resolves to two tracks.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    imageUrl: MEDIA_SOURCES.avatars.business,
    title: 'Update organisation logo',
    apiUrl: '/v1/organisation/logo/signed-url',
    onSave: fn(),
  },
} satisfies Meta<typeof LogoUpdator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chip: Story = {
  name: 'Avatar chip (closed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Update logo' })).toBeInTheDocument();
    // The modal is mounted but not painted, which is why every other story
    // filters on dialog[open] rather than on text.
    await expect(document.querySelector('dialog[open]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state in the header: a 40px round avatar that is the entire trigger. Nothing ' +
          'marks it as editable - no pencil, no hover chrome - so the modal is the only thing that ' +
          'explains what the chip does.',
      },
    },
  },
};

export const ModalOpen: Story = {
  name: 'Update logo modal',
  play: async ({ canvasElement }) => {
    const dialog = await openTheModal(canvasElement);

    // Assert the panel has its content, not merely that a dialog appeared.
    await expect(within(dialog).getByText('Update organisation logo')).toBeInTheDocument();
    // Current logo on the left, the empty well on the right.
    await expect(within(dialog).getByAltText('Logo')).toBeInTheDocument();
    await expect(within(dialog).queryByAltText('New Logo')).toBeNull();

    // The file input is display:none behind its label, so it is reachable by
    // its aria-label rather than by role.
    const input = within(dialog).getByLabelText('Update logo image') as HTMLInputElement;
    await expect(input.accept).toContain('image/png');

    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    await expect(within(dialog).getByRole('button', { name: 'Update' })).toBeInTheDocument();

    /* The action pair only mounts with the dialog. Assert the computed template
       really resolves to two tracks - a dropped or malformed template collapses
       both buttons into one column and still looks deliberate. */
    const actions = cancel.parentElement as HTMLElement;
    await expect(getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The modal as it opens: current logo, arrow, and the bordered 100px well with a 40px ' +
          'camera glyph centred in it. Nothing has been picked yet, so Update is live but would ' +
          'only produce the "Please choose an image to upload." message.',
      },
    },
  },
};

export const PreviewSelected: Story = {
  name: 'File picked (blob preview)',
  play: async ({ canvasElement }) => {
    const dialog = await openTheModal(canvasElement);
    const input = within(dialog).getByLabelText('Update logo image') as HTMLInputElement;

    // `fireEvent` rather than `userEvent.upload`: the input is `display: none`
    // behind its label, so a synthetic click on it is not a reliable way to
    // reach the change handler.
    fireEvent.change(input, { target: { files: [makeFile('new-logo.png', 'image/png')] } });

    // The camera glyph is replaced in place by an object-URL preview - the
    // only render where both the old and the new logo are on screen together.
    const preview = await within(dialog).findByAltText('New Logo');
    await expect(preview).toBeInTheDocument();
    await expect(preview.getAttribute('src')).toMatch(/^blob:/);
    await expect(within(dialog).getByAltText('Logo')).toBeInTheDocument();

    // The well drops its ring once a preview fills it (`border-0` vs `border`).
    const well = dialog.querySelector('label[for]') as HTMLElement;
    await expect(well).toHaveClass('border-0');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A picked file, previewed locally before anything is uploaded. The `src` is restricted to ' +
          '`blob:` on purpose - `getSafePreviewUrl` rejects every other scheme, so a data: or SVG ' +
          'URL can never reach the `<img>`. Nothing has been sent yet; Update is what starts the ' +
          'signed-URL request.',
      },
    },
  },
};

export const RejectedFileType: Story = {
  name: 'Unsupported file rejected',
  play: async ({ canvasElement }) => {
    const dialog = await openTheModal(canvasElement);
    const input = within(dialog).getByLabelText('Update logo image') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile('logo.svg', 'image/svg+xml')] } });

    await expect(
      await within(dialog).findByText('Please choose a valid image file (PNG, JPG, or WEBP).')
    ).toBeInTheDocument();
    // The rejection is local, so the well stays empty rather than previewing
    // something that will fail later.
    await expect(within(dialog).queryByAltText('New Logo')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An SVG refused before any network call. The message appears under the well, inside the ' +
          'same centred column, so it pushes the Cancel/Update row down - this is the tallest the ' +
          'modal ever gets, and the only render that composites the error line with the action ' +
          'grid.',
      },
    },
  },
};

export const Disabled: Story = {
  name: 'Disabled chip',
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Update logo' });
    await expect(trigger).toBeDisabled();
    // The handler is guarded twice - `disabled` on the element and a check
    // inside onClick - so the modal stays shut.
    await expect(document.querySelector('dialog[open]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While the organisation profile is still loading the chip is disabled. It is genuinely ' +
          '`disabled` rather than merely dimmed, so it is skipped by the tab order too.',
      },
    },
  },
};
