import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import Disclaimer from './Disclaimer';
import { CLINICAL_DISCLAIMER } from '@/app/features/calculators/constants';

const BADGE_LABEL = 'Clinical decision support';
const SHORT_TEXT = 'Canine and feline formulas only.';

/**
 * How many line boxes the caption occupies. The caption is a flex item, so it is
 * blockified and `getClientRects()` collapses to a single rect however many lines
 * it draws - height over the computed line-height is the only reading left.
 */
const lineCount = (element: HTMLElement): number => {
  const lineHeight = Number.parseFloat(globalThis.getComputedStyle(element).lineHeight);
  return Math.round(element.getBoundingClientRect().height / lineHeight);
};

/**
 * The badge/caption relationship IS the responsive rule: `sm:flex-row items-center`
 * at >=640px, a bare column below it.
 *
 * Which one is live depends on the real window width, and the viewport global only
 * pins that in the Storybook UI - a story rendered straight from `iframe.html`
 * (which is how the verification harness renders it) keeps the runner's width and
 * would quietly measure the desktop row while claiming to check the phone. So read
 * the width that is actually in force instead of assuming one.
 */
const expectLayoutForWidth = async (badge: HTMLElement, caption: HTMLElement) => {
  const badgeBox = badge.getBoundingClientRect();
  const captionBox = caption.getBoundingClientRect();

  if (globalThis.matchMedia('(min-width: 640px)').matches) {
    // One row: the badge leads and the caption starts after it, both on the same band.
    await expect(badgeBox.right).toBeLessThanOrEqual(captionBox.left);
    await expect(badgeBox.top).toBeLessThan(captionBox.bottom);
    await expect(captionBox.top).toBeLessThan(badgeBox.bottom);
    return;
  }

  // Stacked: the badge sits above the caption, flush to the same left edge.
  await expect(badgeBox.bottom).toBeLessThanOrEqual(captionBox.top);
  await expect(Math.round(badgeBox.left)).toBe(Math.round(captionBox.left));
  /* `w-fit` on the badge is load-bearing here and nowhere else: a column flex
     container stretches its children, so without it the pill would run the full
     width of the banner and read as a heading bar rather than a badge. */
  await expect(badgeBox.width).toBeLessThan(captionBox.width);
};

const meta = {
  title: 'Calculators/Disclaimer',
  component: Disclaimer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The warning banner every calculator carries. It is not a pass-through to `Badge`: it ' +
          'owns its own `role="note"` and the "Clinical decision support disclaimer" accessible ' +
          'name, so a screen reader reaches it as an annotation rather than as a stray pill and a ' +
          'stray sentence.\n\n' +
          'Layout is the other reason it exists. Below 640px the badge stacks above the caption and ' +
          '`w-fit` is what stops the column flex from stretching the pill to the full banner width; ' +
          'at and above 640px `sm:flex-row items-center` puts the badge in front of the caption on ' +
          'one row. Both branches are drawn here.',
      },
    },
  },
  tags: ['autodocs'],
  args: { text: CLINICAL_DISCLAIMER },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Disclaimer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The shipped disclaimer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The aria contract fails invisibly - the banner looks identical with the
       role dropped, and only assistive tech notices it stopped being an
       annotation. */
    const note = canvas.getByRole('note');
    await expect(note).toHaveAccessibleName('Clinical decision support disclaimer');

    const caption = canvas.getByText(CLINICAL_DISCLAIMER);
    await expectLayoutForWidth(canvas.getByText(BADGE_LABEL), caption);
    // Three sentences in a 460px panel: this is the wrapping case, not one line.
    await expect(lineCount(caption)).toBeGreaterThan(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The real `CLINICAL_DISCLAIMER` constant, which is what every calculator renders. Long ' +
          'enough to wrap several times in the narrow calculators panel.',
      },
    },
  },
};

export const ShortText: Story = {
  name: 'A one-line disclaimer',
  args: { text: SHORT_TEXT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const caption = canvas.getByText(SHORT_TEXT);
    // One line box. The banner keeps its 16px padding and pill geometry at its
    // minimum height, which is the case the vertical rhythm is easiest to get
    // wrong in.
    await expect(lineCount(caption)).toBe(1);
    await expectLayoutForWidth(canvas.getByText(BADGE_LABEL), caption);
  },
};

export const Phone: Story = {
  name: 'Phone: badge stacks above the text',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectLayoutForWidth(
      canvas.getByText(BADGE_LABEL),
      canvas.getByText(CLINICAL_DISCLAIMER)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below the `sm` breakpoint the pill moves onto its own line above the caption. Pinned to ' +
          'the `mobile` viewport for the Storybook UI; the assertion reads the live width so it ' +
          'checks whichever branch it is actually rendered in.',
      },
    },
  },
};
