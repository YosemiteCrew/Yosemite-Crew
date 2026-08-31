import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CompanionRecordsEmptyState from './CompanionRecordsEmptyState';

const SUPPORTING_COPY =
  'Everything from visits lands here automatically: SOAP notes, labs, prescriptions, invoices. ' +
  'You can also upload history from a previous clinic.';

/** The decorative folder chip: the block's first child, hidden from the a11y tree. */
const chip = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[aria-hidden="true"]') as HTMLElement;

const meta = {
  title: 'Documents/CompanionRecordsEmptyState',
  component: CompanionRecordsEmptyState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "No records yet" block from the Records & Reference design, and the one empty ' +
          'state two features share: `CompanionDocumentsSection` renders it with the upload ' +
          'actions, and `HistoryEmptyState` renders it bare for a companion with no history ' +
          '(errors and caller-supplied notices take the compact notice box instead).\n\n' +
          'The component owns the chip, the headline and the copy; the caller owns the actions ' +
          'entirely. That split is the point of the `action` slot - the buttons in the records ' +
          'tab sit behind a `companions:edit:any` gate, so a viewer without edit rights gets ' +
          'this exact block with nothing under the copy, and no empty action row is left behind.',
      },
    },
  },
  tags: ['autodocs'],
  args: { action: undefined },
} satisfies Meta<typeof CompanionRecordsEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bare: Story = {
  name: 'Copy only, no actions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The full supporting line, not just the headline. It is the only place the
       block says records arrive on their own, and without it the state reads as
       "nothing works yet". Exact string, because the preview decorator injects
       an sr-only <h1> into this canvas and a loose /no records/i would match it. */
    await expect(canvas.getByText('No records yet')).toBeInTheDocument();
    await expect(canvas.getByText(SUPPORTING_COPY)).toBeInTheDocument();

    /* No action slot means no action row at all. The `action ? ... : null`
       branch matters: a rendered-but-empty flex row would leave a 10px gap
       under the copy on every read-only companion. */
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryAllByRole('link')).toHaveLength(0);

    /* The chip is a 64px circle and decorative. Measured rather than read off
       the class, because `size-16` is the design's number and a screen reader
       announcing an unlabelled graphic here is a silent regression. */
    const box = chip(canvasElement).getBoundingClientRect();
    await expect(box.width).toBe(64);
    await expect(box.height).toBe(64);

    /* The headline is the brand serif. `font-newsreader` resolves through
       `--font-newsreader`, and when that token goes missing the headline falls
       back to Georgia and still renders at 23px - visibly wrong, silently
       passing. */
    await expect(getComputedStyle(canvas.getByText('No records yet')).fontFamily).toMatch(
      /Newsreader/
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'What `HistoryEmptyState` renders, and what a member without edit rights sees in the ' +
          'records tab.',
      },
    },
  },
};

export const WithUploadAction: Story = {
  name: 'With the upload call to action',
  args: {
    action: <Primary href="#" text="Upload record" onClick={fn()} className="w-auto min-w-37.5" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const upload = canvas.getByRole('button', { name: 'Upload record' });

    // Exactly one action, and it is under the copy rather than beside it.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(upload.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      canvas.getByText(SUPPORTING_COPY).getBoundingClientRect().bottom
    );
    await expect(upload).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The records tab for a member who can edit. `href="#"` is deliberate on this CTA: ' +
          '`BaseButton` treats `#` as "not a link" and renders a real `<button>`, so the click ' +
          'opens the upload panel instead of pushing a route.',
      },
    },
  },
};

const BOTH_ACTIONS = (
  <>
    <Primary href="#" text="Upload record" onClick={fn()} className="w-auto min-w-37.5" />
    <Secondary href="#" text="Request from pet parent" isDisabled />
  </>
);

export const TwoActions: Story = {
  name: 'Phone: the actions wrap',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { action: BOTH_ACTIONS },
  /* The width is pinned twice on purpose. The viewport global resizes the
     preview iframe from the MANAGER, so a play function loaded straight from
     `iframe.html` - the story verifier, any headless run - measures the full
     panel width and cheerfully reports desktop geometry as a phone result. It
     reported these two pills side by side, which at 375px they are not. This
     block has no media query, so a 375px box is the same reflow a phone gets. */
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const upload = canvas.getByRole('button', { name: 'Upload record' });
    const request = canvas.getByRole('button', { name: 'Request from pet parent' });
    const block = canvasElement.querySelector('.flex-col') as HTMLElement;

    /* The pair is wider than the block's 327px content box, so `flex-wrap` puts
       the second action on its own line. This is what the wrap is for, and the
       failure it prevents is not the extra row - it is the secondary pill
       running outside the block and being clipped by the panel around it. */
    await expect(block.getBoundingClientRect().width).toBe(375);
    await expect(request.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      upload.getBoundingClientRect().bottom
    );
    await expect(block.scrollWidth).toBeLessThanOrEqual(block.clientWidth);

    /* The design pairs the upload CTA with "Request from pet parent", and there
       is no request flow behind it - so it ships genuinely disabled rather than
       looking live and doing nothing. */
    await expect(request).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pair the records tab actually passes in, at the narrowest width the app renders. ' +
          'The slot is a plain `flex-wrap` row, so the caller decides the order and the ' +
          'component decides when it breaks - which on a phone is immediately, since the CTA ' +
          'alone carries a `min-w-37.5`.',
      },
    },
  },
};
