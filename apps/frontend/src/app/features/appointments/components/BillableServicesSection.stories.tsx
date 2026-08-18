import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import BillableServicesSection from './BillableServicesSection';
import type { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';

const SERVICE_NAME = 'Dental scale and polish';

const SERVICE_FIELDS: FieldConfig[] = [
  { label: 'Service code', key: 'code', type: 'text' },
  { label: 'Quantity', key: 'quantity', type: 'number' },
  { label: 'Unit price', key: 'unitPrice', type: 'text' },
  { label: 'Discount', key: 'discount', type: 'text' },
  { label: 'Taxable', key: 'taxable', type: 'checkbox' },
];

const SERVICE_DATA: Record<string, string | boolean> = {
  code: 'DEN-204',
  quantity: '1',
  unitPrice: '$180.00',
  discount: '10%',
  taxable: true,
};

const meta = {
  title: 'Appointments/BillableServicesSection',
  component: BillableServicesSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Billable services" block in the appointment drawer: an outer `Accordion` whose body ' +
          'holds a **second, nested** `EditableAccordion` for the chosen service.\n\n' +
          'Both levels were invisible. The outer accordion defaults to closed (`defaultOpen` is ' +
          'undefined, so `Accordion` falls back to `false`), and `Accordion` renders its body inside ' +
          '`open && hasChildren` - the children are not merely hidden, they are never mounted. So ' +
          'nothing in Storybook had ever composited the nested card inside the parent: two stacked ' +
          "borders, the inner card's own `border-x border-b rounded-b-2xl` body sitting inside the " +
          "outer body's `pb-2 px-3`, and the `border-t` divider on every field row.\n\n" +
          'That nesting is exactly the shape of the layout bugs this batch exists for - a grid or a ' +
          'border set that only composites once a second surface is mounted inside the first. A ' +
          'closed accordion draws none of it.\n\n' +
          'One correction to note against the audit that produced this file: there is no inline field ' +
          'editor to reach here. The section passes `showEditIcon={false}` to **both** accordions and ' +
          '`isEditing={true}` to the outer one, so neither renders a pencil and the nested card is ' +
          "read-only by construction. `EditableAccordion`'s edit mode is covered by its own stories; " +
          'what is unique to this file is the read-only nesting and the empty branch.\n\n' +
          'The body has two mutually exclusive branches, and which one renders is a three-part ' +
          'condition: `serviceId` set **and** `serviceFields` non-empty **and** at least one value in ' +
          "`serviceInfoData` that is neither `null` nor `''`. Fail any one and the block collapses " +
          'to a single 13px `--text-secondary` line instead. A service with fields but no values ' +
          'lands on the fallback, which is the case most likely to be mistaken for a rendering fault.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    serviceId: 'svc-dental-204',
    serviceName: SERVICE_NAME,
    serviceFields: SERVICE_FIELDS,
    serviceInfoData: SERVICE_DATA,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof BillableServicesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed (default)',
  parameters: {
    docs: {
      story:
        'How the section arrives in the drawer: one 12px-padded row with a rotated chevron and a ' +
        'full `rounded-2xl` border. The body - and everything below - is unmounted.',
    },
  },
};

export const Expanded: Story = {
  name: 'Expanded - nested service card',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Billable services' }));

    // The nested accordion, not just the outer one. Its header carries the service
    // name as its aria-label, and it opens itself (`defaultOpen`), so the rows below
    // are on screen as soon as the parent mounts them.
    await expect(canvas.getByRole('button', { name: SERVICE_NAME })).toBeInTheDocument();

    // Assert the rows actually rendered. Checking only that the parent flipped
    // aria-expanded would pass on an empty body, which is precisely how a
    // regression in a gated panel stays invisible.
    await expect(canvas.getByText('Service code')).toBeInTheDocument();
    await expect(canvas.getByText('DEN-204')).toBeInTheDocument();
    await expect(canvas.getByText('Unit price')).toBeInTheDocument();
    await expect(canvas.getByText('$180.00')).toBeInTheDocument();
    // The checkbox row renders as a word, not an input, in the read view.
    await expect(canvas.getByText('Taxable')).toBeInTheDocument();
    await expect(canvas.getByText('Yes')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The surface this file exists for: five label/value rows inside a card inside a card. Each ' +
        'row is a `justify-between` flex with a `border-t border-card-border`, so the first row draws ' +
        "a divider directly under the nested header - the join between the two cards' borders is only " +
        'visible here.',
    },
  },
};

export const NoServiceSelected: Story = {
  name: 'Empty - no service chosen',
  args: { serviceId: undefined, serviceName: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Billable services' }));
    await expect(
      canvas.getByText('Select a service to view billable details.')
    ).toBeInTheDocument();
    // The nested card must be absent, not empty.
    await expect(canvas.queryByRole('button', { name: SERVICE_NAME })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Without a `serviceId` the body is a single line of `text-body-4 text-text-secondary` with ' +
        '`py-1`. Worth drawing beside the populated branch: the open accordion is far shorter here, ' +
        'so a drawer laid out around the expanded height reflows when the service is cleared.',
    },
  },
};

export const FieldsButNoValues: Story = {
  name: 'Empty - service chosen, every value blank',
  args: { serviceInfoData: { code: '', quantity: '', unitPrice: '', discount: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Billable services' }));
    await expect(
      canvas.getByText('Select a service to view billable details.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The branch most likely to be read as a bug. A service **is** selected and its fields **are** ' +
        "configured, but `hasAnyValue` finds nothing that is neither `''` nor nullish, so the " +
        'fallback line wins over a card of dashes. Compare with `EditableAccordion`, which renders an ' +
        'unset row as "-" rather than hiding it.',
    },
  },
};

export const ControlledOpen: Story = {
  name: 'Controlled open',
  args: { open: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No click: `open` is driven from the parent, so the body must already be mounted.
    await expect(canvas.getByRole('button', { name: SERVICE_NAME })).toBeInTheDocument();
    await expect(canvas.getByText('DEN-204')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The controlled path the appointment drawer uses to expand one section and collapse the rest. ' +
        'With `open` supplied, `Accordion` stops tracking its own state and only reports through ' +
        "`onOpenChange`, so a caller that forgets to store that callback's value gets a section that " +
        'can never be closed.',
    },
  },
};
