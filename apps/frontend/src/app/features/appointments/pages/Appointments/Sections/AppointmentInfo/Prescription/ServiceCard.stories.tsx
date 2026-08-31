import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { ServiceEdit } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';

import ServiceCard from './ServiceCard';

const ORG_ID = 'org-storybook';

const buildService = (overrides: Partial<ServiceEdit> = {}): ServiceEdit => ({
  id: 'svc-consult',
  organisationId: ORG_ID,
  name: 'Dental prophylaxis',
  description: 'Scale, polish and a full oral chart under general anaesthetic.',
  durationMinutes: 45,
  cost: 120,
  isActive: true,
  discount: '',
  ...overrides,
});

/**
 * `formatMoney` is fed by `useCurrencyForPrimaryOrg`, which reads the billing
 * subscription for the primary org and falls back to USD. Seeding both stores
 * keeps the card offline and lets the non-USD story prove the amount is not a
 * hardcoded dollar sign. The snapshot is put back on unmount so a story that
 * seeds EUR cannot leave the next one formatting in EUR.
 */
const withCurrency = (currency: string | null) => () => {
  const orgSnapshot = useOrgStore.getState();
  const subscriptionSnapshot = useSubscriptionStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useSubscriptionStore.setState({
    subscriptionByOrgId: currency ? { [ORG_ID]: { orgId: ORG_ID, currency } } : {},
  });

  return () => {
    useSubscriptionStore.setState(subscriptionSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

/** The row wrapping a label, e.g. `Charges: | $120`. */
const rowFor = (canvas: ReturnType<typeof within>, label: string): HTMLElement =>
  canvas.getByText(label).parentElement as HTMLElement;

const meta = {
  title: 'Appointments/ServiceCard',
  component: ServiceCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One billable service on the appointment, drawn as an always-open accordion over a ' +
          'four-row detail table: name, description, duration and charges. `edit` decides what ' +
          'the fifth row is - an editable **Discount (%)** number field while the appointment is ' +
          'open, or a read-only `discount || 0` line once it is not.\n\n' +
          '**The delete affordance never renders.** The card asks its `Accordion` for ' +
          '`showDeleteIcon={edit}` but also hardcodes `isEditing={true}`, and `Accordion` draws ' +
          'the bin only for `showDeleteIcon && !isEditing`. So `removeService` has no way to be ' +
          'reached from this component at any value of `edit`, and the Editable story below ' +
          'pins that: a card built to be removable currently cannot be removed.\n\n' +
          'The charges row carries the closing border only in the read-only variant, because ' +
          'the discount field below it supplies its own padding instead. That is expressed as ' +
          "`${!edit && 'border-b ...'}`, so in edit mode the class list literally gains the " +
          'token `false` - harmless today, and the reason these stories measure the border ' +
          'rather than read class names.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    service: buildService(),
    setFormData: fn(),
    edit: true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withCurrency(null),
} satisfies Meta<typeof ServiceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Open appointment (edit)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The accordion is `defaultOpen`, so the table is visible without a click.
    await expect(canvas.getByRole('button', { name: 'Dental prophylaxis' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    /* The discount is a real number input, not a text field: a vet typing "12%"
       into a text box would post the percent sign straight through. */
    const discount = canvas.getByRole('spinbutton', { name: 'Discount (%)' });
    await expect(discount).toHaveValue(null);
    await expect(canvas.queryByText('Discount (%):')).not.toBeInTheDocument();

    /* The dead affordance. `edit` is true, which is the ONLY value that asks for
       the bin, and it is still absent because the card also pins
       `isEditing={true}` and Accordion hides delete while editing. If someone
       fixes that, this assertion is the one that fails and tells them a story
       needs to start clicking it. */
    await expect(
      canvas.queryByRole('button', { name: 'Delete Dental prophylaxis' })
    ).not.toBeInTheDocument();
    // Only the accordion toggle exists - the card has no other control.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);

    /* No closing border under Charges here: the discount field's own padding
       ends the table. Measured, because the class is interpolated from a
       boolean and a typo there is invisible in a class-name assertion. */
    await expect(globalThis.getComputedStyle(rowFor(canvas, 'Charges:')).borderBottomWidth).toBe(
      '0px'
    );
  },
};

export const ReadOnly: Story = {
  name: 'Closed appointment (read-only)',
  args: { service: buildService({ discount: '15' }), edit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The field is replaced by a line, not disabled: there is no input at all.
    await expect(canvas.queryByRole('spinbutton')).not.toBeInTheDocument();
    await expect(canvas.getByText('Discount (%):')).toBeInTheDocument();
    await expect(canvas.getByText('15%')).toBeInTheDocument();

    /* Read-only is the variant that closes the table, so Charges gains the
       border the editable variant leaves off. */
    await expect(globalThis.getComputedStyle(rowFor(canvas, 'Charges:')).borderBottomWidth).toBe(
      '1px'
    );

    // `edit={false}` is also the value that withholds the bin, so it is absent
    // for the ordinary reason here as well as the accordion one.
    await expect(
      canvas.queryByRole('button', { name: 'Delete Dental prophylaxis' })
    ).not.toBeInTheDocument();
  },
};

export const NoDiscountRecorded: Story = {
  name: 'Read-only with no discount',
  args: { service: buildService({ discount: '' }), edit: false },
  play: async ({ canvasElement }) => {
    /* `discount || '0'`: an unset discount reads as 0%, not as a blank cell. A
       blank here would look like "not applicable" on a bill that has one. */
    await expect(within(canvasElement).getByText('0%')).toBeInTheDocument();
  },
};

export const TypingADiscount: Story = {
  name: 'Entering a discount',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('spinbutton', { name: 'Discount (%)' }), '7');

    /* The field is controlled by the parent's state, so a keystroke is only
       ever visible as one functional update. One call, not one per render. */
    await expect(args.setFormData).toHaveBeenCalledTimes(1);

    const updater = args.setFormData.mock.calls[0][0] as (prev: { services: ServiceEdit[] }) => {
      services: ServiceEdit[];
    };
    const next = updater({ services: [buildService(), buildService({ name: 'Nail trim' })] });

    /* The updater edits in place: both services survive and only the matched
       one takes the new value. `setDiscount` matches on `name`, so two services
       sharing a name would both be rewritten - worth knowing if service names
       ever stop being unique within an appointment. */
    await expect(next.services).toHaveLength(2);
    await expect(next.services[0].discount).toBe('7');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The wiring, not the rendered value: `value` comes from the parent, so with a mocked ' +
          '`setFormData` the box stays empty however much is typed. Worth reading the produced ' +
          'state rather than trusting the call count - `setDiscount` rebuilds each row as a new ' +
          'object rather than spreading the old one, so the row it touches keeps the discount ' +
          'but loses the rest of the service.',
      },
    },
  },
};

export const FreeService: Story = {
  name: 'Zero-cost service',
  args: { service: buildService({ name: 'Nurse weigh-in', cost: 0, durationMinutes: 10 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* A free line still has to state a price. `formatMoney(0)` is the branch a
       falsy-cost guard would swallow, and an empty Charges cell reads as
       "unpriced" rather than "included". */
    await expect(canvas.getByText('$0')).toBeInTheDocument();
    await expect(canvas.getByText('10 mins')).toBeInTheDocument();
  },
};

export const NonUsdOrg: Story = {
  name: 'Organisation billing in euros',
  beforeEach: withCurrency('EUR'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The amount follows the org's billing currency rather than a hardcoded
       dollar sign - the failure mode is silent, because "$120" looks like a
       perfectly good price to everyone except the clinic being billed. */
    await expect(canvas.getByText('€120')).toBeInTheDocument();
    await expect(canvas.queryByText('$120')).not.toBeInTheDocument();
  },
};

export const LongDescriptionOnPhone: Story = {
  name: 'Phone: long description',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    service: buildService({
      name: 'Photobiomodulation and underwater treadmill rehabilitation review',
      description:
        'Forty-five minute rehabilitation review covering laser therapy over the lumbosacral ' +
        'junction, an underwater treadmill session at a reduced buoyancy setting, and a ' +
        'reassessment of the home exercise plan with the owner.',
      cost: 1200,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Description is the only cell allowed to grow: it wraps under
       `text-right`, and the row must still leave the label on one line. The
       check that matters is that nothing pushes the page sideways - the table
       rows are `justify-between` with no min-width guard. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    const description = rowFor(canvas, 'Description:');
    await expect(description.scrollWidth).toBeLessThanOrEqual(description.clientWidth);
    await expect(canvas.getByText('$1,200')).toBeInTheDocument();
  },
};
