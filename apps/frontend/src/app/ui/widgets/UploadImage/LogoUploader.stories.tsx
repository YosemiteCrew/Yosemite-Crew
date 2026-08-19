import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';

import LogoUploader from './LogoUploader';

const meta = {
  title: 'Widgets/UploadImage/LogoUploader',
  component: LogoUploader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The round logo well used in organisation and team onboarding: a camera chip that opens ' +
          'the file picker, and the caption beside it that doubles as the live status region. Once ' +
          'an image is accepted the chip is replaced in place by a 58px preview with a remove ' +
          'button, so the picked logo is confirmed before the form is saved. Non-image and SVG ' +
          'files are rejected in the browser, before any signed-URL request is made.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Add your practice logo',
    apiUrl: '/v1/storage/signed-url',
    setImageUrl: fn(),
  },
} satisfies Meta<typeof LogoUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The resting state: camera chip, "LOGO" caption and the prompt beside it. The
 * preview only replaces the chip once a file has been accepted, so this is what
 * an organisation without a logo always shows.
 */
export const Default: Story = {};

/**
 * The rejection path, and the reason it is worth a story: SVGs are refused
 * because they can carry script, and the refusal happens locally — no upload is
 * attempted. The message lands in a `role="alert"` under the caption while the
 * chip stays in its empty state, so nothing looks half-attached.
 */
export const InvalidFileType: Story = {
  name: 'SVG rejected',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Upload logo image') as HTMLInputElement;
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" />'], 'logo.svg', {
      type: 'image/svg+xml',
    });

    // `fireEvent` rather than `userEvent.upload`: the input is `display: none`
    // behind its label, so a synthetic click on it is not a reliable way to
    // reach the change handler.
    fireEvent.change(input, { target: { files: [svg] } });

    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Only non-SVG image files are supported.');
  },
};
