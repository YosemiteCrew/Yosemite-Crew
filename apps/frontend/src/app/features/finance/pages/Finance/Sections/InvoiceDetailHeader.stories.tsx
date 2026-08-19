import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import InvoiceDetailHeader from './InvoiceDetailHeader';

const ORG_ID = 'org-avenger-park';
const APPOINTMENT_ID = 'appointment-8842';
const PARENT_ID = 'parent-sky-doe';

const patient: Appointment['patient'] = {
  id: 'companion-kizie',
  name: 'Kizie',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: PARENT_ID, name: 'Sky Doe' },
};

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  organisationId: ORG_ID,
  patient,
  companion: patient,
  appointmentType: {
    id: 'type-dental',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  // Fixed instants throughout. Every formatter here pins the en-US locale and
  // `getPreferredTimeZone` falls back to Europe/Berlin with no timezone token stored,
  // so the rendered dates do not depend on the machine running this.
  appointmentDate: new Date('2026-08-12T09:30:00.000Z'),
  startTime: new Date('2026-08-12T09:30:00.000Z'),
  endTime: new Date('2026-08-12T10:00:00.000Z'),
  timeSlot: '09:30 AM',
  durationMinutes: 30,
  status: 'COMPLETED',
};

/**
 * A rendered invoice document. `pdfUrl` is the only thing gating the PDF action, and
 * it is populated by the backend's document renderer - so it is absent for the whole
 * window between an invoice being created and its PDF being generated, and absent
 * forever on an invoice that never rendered.
 */
const INVOICE: Invoice = {
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  parentId: PARENT_ID,
  metadata: { invoiceNumber: 'INV-2026-0142' },
  items: [{ id: 'line-1', name: 'Dental consultation', quantity: 1, unitPrice: 60, total: 60 }],
  subtotal: 60,
  taxPercent: 20,
  taxTotal: 12,
  totalAmount: 72,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PAID',
  pdfUrl: 'https://d2il6osz49gpup.cloudfront.net/invoices/INV-2026-0142.pdf',
  paidAt: new Date('2026-08-12T10:15:00.000Z'),
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
  updatedAt: new Date('2026-08-12T10:15:00.000Z'),
};

/**
 * The header's interactive controls, left to right as they are PAINTED.
 *
 * The status badge is a `<span>` and never appears here; it sits first in the row and
 * is checked by text where it matters.
 */
const actionsInOrder = (canvasElement: HTMLElement): string[] =>
  [...canvasElement.querySelectorAll('a, button')]
    .map((el) => ({ el, left: el.getBoundingClientRect().left }))
    .sort((a, b) => a.left - b.left)
    .map(({ el }) => el.getAttribute('aria-label') ?? (el.textContent ?? '').trim());

/** The header row itself, used as the box everything must stay inside. */
const headerRow = (el: HTMLElement): HTMLElement =>
  el.closest('.flex.items-start.justify-between') as HTMLElement;

const meta = {
  title: 'Finance/InvoiceDetailHeader',
  component: InvoiceDetailHeader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The header of the desktop invoice drawer: companion avatar, invoice number, a ' +
          'composed subtitle, and an actions row that ends in the close button.\n\n' +
          'The actions row is **entirely conditional**, and one of its three controls had never ' +
          'been drawn: the **PDF download link**, gated on `invoice.pdfUrl`. That field is written ' +
          "by the backend's document renderer, so it is empty for every invoice between creation " +
          'and render, and permanently empty on one that never rendered - which means the header ' +
          'ships in two shapes and only one of them was ever reviewed.\n\n' +
          'It is a real `<a>`, not a button: it opens the rendered document in a new tab with ' +
          '`rel="noopener noreferrer"`, and it carries a per-invoice `aria-label` ("Download ' +
          'invoice #INV-2026-0142 PDF") because the visible label is just "PDF" and a screen ' +
          'reader would otherwise hear the same two letters on every invoice in a list.\n\n' +
          '"Open appointment" is gated separately, on **both** an appointment and a handler, so ' +
          'an unlinked over-the-counter sale gets neither it nor a subtitle - `buildSubtitle` ' +
          'returns an empty string and `ModalHeader` drops the meta line rather than rendering a ' +
          'blank one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    titleId: 'invoice-detail-title',
    invoice: INVOICE,
    appointment: APPOINTMENT,
    statusLabel: 'Paid',
    statusTone: 'success',
    onClose: fn(),
    onOpenAppointment: fn(),
  },
  decorators: [
    (Story) => (
      // 788px is the drawer's content box: an `lg` centered Modal (840px) less its
      // 26px horizontal insets. The actions row is `shrink-0`, so the width decides
      // where the title truncates rather than whether the buttons fit.
      <div className="w-[788px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceDetailHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPdf: Story = {
  name: 'A rendered invoice (PDF available)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The number comes from metadata, not from the opaque id, and the title carries
    // the id the dialog is labelled by.
    const heading = canvas.getByRole('heading', { name: '#INV-2026-0142' });
    await expect(heading).toHaveAttribute('id', 'invoice-detail-title');

    // The subtitle is composed from the appointment: companion, owner surname,
    // service, date - joined by middle dots and with empty parts dropped.
    await expect(
      canvas.getByText('Kizie · Doe · Dental consultation · Aug 12, 2026')
    ).toBeInTheDocument();

    /* The PDF action, in full. The href, the new-tab target and the opener guard are
       all asserted rather than only the label: this link points at a rendered billing
       document, and `target="_blank"` without `rel="noopener"` hands the destination a
       handle on this window. */
    const pdf = canvas.getByRole('link', { name: 'Download invoice #INV-2026-0142 PDF' });
    await expect(pdf).toHaveAttribute(
      'href',
      'https://d2il6osz49gpup.cloudfront.net/invoices/INV-2026-0142.pdf'
    );
    await expect(pdf).toHaveAttribute('target', '_blank');
    await expect(pdf).toHaveAttribute('rel', 'noopener noreferrer');
    // The visible label is two letters. The accessible name carries the invoice, which
    // is the whole reason the aria-label exists.
    await expect(pdf).toHaveTextContent('PDF');

    /* Order matters: PDF, then Open appointment, then Close, with the status badge
       ahead of all three. Read off measured positions rather than DOM order, because
       the row is a flex container - a `flex-row-reverse` or an `order` utility would
       reverse the paint without touching the markup, and Close must stay last. */
    await expect(actionsInOrder(canvasElement)).toEqual([
      'Download invoice #INV-2026-0142 PDF',
      'Open appointment',
      'Close',
    ]);
    const badge = canvas.getByText('Paid');
    await expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(
      pdf.getBoundingClientRect().left
    );

    // Both action controls are 36px pills so they line up with the status badge.
    await expect(Math.round(pdf.getBoundingClientRect().height)).toBe(36);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every control the header can show at once: the status badge, the PDF link, the route ' +
          'into the appointment workspace, and the close button. This is the widest the actions ' +
          'row ever gets, so it is the layout reference for the two shorter shapes below.',
      },
    },
  },
};

export const WithoutPdf: Story = {
  name: 'No PDF rendered yet',
  args: { invoice: { ...INVOICE, pdfUrl: undefined } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The link is ABSENT, not disabled and not a dead href - there is nothing to
       download. Queried by role rather than by the visible "PDF" text, which is two
       letters that could easily appear elsewhere in a billing panel. */
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
    await expect(canvas.queryByText('PDF')).not.toBeInTheDocument();

    // Everything else is unchanged - the row is SHORTER, not different, and the
    // remaining controls simply slide right.
    await expect(actionsInOrder(canvasElement)).toEqual(['Open appointment', 'Close']);
    await expect(canvas.getByRole('heading', { name: '#INV-2026-0142' })).toBeInTheDocument();
    await expect(canvas.getByText('Paid')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state most invoices are in for their first seconds, and permanently for any ' +
          'invoice whose document never rendered. Nothing on the header says a PDF is coming - ' +
          'the control simply is not there - so a reader who saw it on the previous invoice has ' +
          'no way to tell whether it is pending or will never arrive.',
      },
    },
  },
};

export const UnlinkedSale: Story = {
  name: 'Unlinked sale: PDF but no appointment',
  args: {
    invoice: { ...INVOICE, appointmentId: undefined, metadata: { invoiceNumber: 'INV-2026-0009' } },
    appointment: undefined,
    onOpenAppointment: undefined,
    statusLabel: 'Awaiting payment',
    statusTone: 'info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No appointment means no subtitle at all: `buildSubtitle` returns an empty string
    // and `ModalHeader` drops the meta line rather than reserving a blank row for it.
    await expect(canvas.getByRole('heading', { name: '#INV-2026-0009' })).toBeInTheDocument();
    await expect(canvas.queryByText(/·/)).not.toBeInTheDocument();

    // ...and no route into the workspace, because there is nothing to open.
    await expect(
      canvas.queryByRole('button', { name: 'Open appointment' })
    ).not.toBeInTheDocument();

    /* The PDF survives, which is the point of this frame: the two actions are gated on
       different things, so a counter sale with a rendered document still offers the
       download. The avatar falls back to the default dog image rather than
       disappearing, which is why the title still sits inset from the left edge. */
    await expect(
      canvas.getByRole('link', { name: 'Download invoice #INV-2026-0009 PDF' })
    ).toBeInTheDocument();
    await expect(actionsInOrder(canvasElement)).toEqual([
      'Download invoice #INV-2026-0009 PDF',
      'Close',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An over-the-counter sale: no appointment, no companion, no owner. Three separate ' +
          'fallbacks fire - the subtitle vanishes, the workspace route vanishes, and the avatar ' +
          'drops to the species default - while the PDF link is unaffected.',
      },
    },
  },
};

export const ClosesAndOpens: Story = {
  name: 'The two handlers',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Open appointment' }));
    await expect(args.onOpenAppointment).toHaveBeenCalledTimes(1);
    // Opening the appointment does NOT close the header from here - the caller does
    // that after pushing the route, which is why these are two separate props.
    await expect(args.onClose).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await expect(args.onOpenAppointment).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header owns no state. Both controls are pure callbacks, and the PDF link is not ' +
          'one of them - it is an ordinary anchor, so it never reaches the drawer at all and the ' +
          'panel stays open behind the new tab.',
      },
    },
  },
};

export const LongSubtitle: Story = {
  name: 'A long subtitle wraps, the actions do not move',
  args: {
    appointment: {
      ...APPOINTMENT,
      appointmentType: {
        id: 'type-dental',
        name: 'Scale, polish and extraction under general anaesthetic with post-operative analgesia review',
        speciality: { id: 'spec-dentistry', name: 'Dentistry' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The title column is `min-w-0` and the actions are `shrink-0`, so a long service
       name grows the header DOWNWARDS rather than pushing the buttons off the panel.
       Asserted geometrically: everything still ends inside the header row. */
    const pdf = canvas.getByRole('link', { name: 'Download invoice #INV-2026-0142 PDF' });
    const limit = headerRow(pdf).getBoundingClientRect().right;
    await expect(pdf.getBoundingClientRect().right).toBeLessThanOrEqual(limit + 1);
    await expect(
      canvas.getByRole('button', { name: 'Close' }).getBoundingClientRect().right
    ).toBeLessThanOrEqual(limit + 1);

    /* The two lines behave differently, and that asymmetry is the point of this
       frame. The title carries `truncate`; the meta line carries nothing and wraps.

       Both are counted over a RANGE rather than off the element. `ModalHeader` puts
       both nodes in a `flex flex-col`, so each one is blockified and its OWN
       `getClientRects()` is a single border box however many lines the text took -
       an element-level count reads 1 for the wrapped subtitle and would fail, and
       reads 1 for the title whether or not `nowrap` survived, which passes while
       proving nothing. A Range over the contents returns one rect per line box. */
    const heading = canvas.getByRole('heading', { name: '#INV-2026-0142' });
    const headingStyle = getComputedStyle(heading);
    /* `truncate` is three declarations and it no-ops whenever an unlayered plain-CSS
       rule outranks the utility, which has bitten this repo before - so the rule is
       read off the computed values rather than trusted from the class list. The
       invoice NUMBER is never long enough to clip, so the rule is what there is to
       assert here; the clipping itself is exercised where a name can run long. */
    await expect(headingStyle.whiteSpace).toBe('nowrap');
    await expect(headingStyle.textOverflow).toBe('ellipsis');
    await expect(headingStyle.overflow).toBe('hidden');
    const headingText = document.createRange();
    headingText.selectNodeContents(heading);
    await expect(headingText.getClientRects()).toHaveLength(1);

    const meta = canvas.getByText(/^Kizie · Doe · Scale, polish/);
    await expect(getComputedStyle(meta).whiteSpace).toBe('normal');
    const metaText = document.createRange();
    metaText.selectNodeContents(meta);
    await expect(metaText.getClientRects().length).toBeGreaterThanOrEqual(2);
    // And the wrap is what made the header taller: the meta line is at least two
    // line boxes deep, so the identity column outgrew the 36px action pills.
    await expect(meta.getBoundingClientRect().height).toBeGreaterThan(
      metaText.getClientRects()[0].height
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Service names in this product run long - the dentistry catalogue alone has several over ' +
          'sixty characters. The row is built so the actions never move, and the identity column ' +
          'absorbs it: the number stays on one line under `truncate`, the subtitle under it wraps ' +
          'to two. Worth deciding whether the subtitle should clamp as well, since a three-line ' +
          'meta pushes the billed-items table down the panel on every long-service invoice.',
      },
    },
  },
};
