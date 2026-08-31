import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Organisation, Service } from '@yosemite-crew/types';

import type { BillingSubscription } from '@/app/features/billing/types/billing';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import SpecialityCard from './SpecialityCard';

const ORG_ID = 'org-storybook-speciality-card';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

/**
 * Built the way the onboarding catalogue builds them, but with a distinct number
 * in every numeric field. Three inputs sit in one row of the same shape, so
 * matching values would let a field wired to the wrong key still read correctly.
 */
const service = (name: string, overrides: Partial<Service> = {}): Service => ({
  id: '',
  organisationId: ORG_ID,
  name,
  description: `${name} for observational tools workflows in your hospital organization.`,
  durationMinutes: 20,
  cost: 65,
  maxDiscount: 15,
  serviceType: 'OBSERVATION_TOOL',
  specialityId: 'spec-observational-tools',
  isActive: true,
  ...overrides,
});

const speciality = (name: string, services?: Service[]): SpecialityWeb => ({
  _id: `spec-${name.toLowerCase().split(' ').join('-')}`,
  organisationId: ORG_ID,
  name,
  isActive: true,
  services,
});

const OBSERVATIONAL_TOOLS = speciality('Observational tools', [
  service('Feline Grimace Scale'),
  service('Canine Acute Pain Scale', { durationMinutes: 25, cost: 70, maxDiscount: 5 }),
  service('Equine Grimace Scale', { durationMinutes: 30, cost: 75, maxDiscount: 20 }),
]);

/**
 * `useCurrencyForPrimaryOrg` reaches through the org store into the subscription
 * store, so the currency in the "Service charge" label needs both seeded: the
 * primary org id to look the subscription up with, and the subscription to read
 * `currency` off. With no subscription at all the hook falls back to USD, which
 * is what a free organisation sees - so that is the default here rather than a
 * seeded USD record.
 */
const withCurrency = (currency?: string) => () => {
  const orgSnapshot = useOrgStore.getState();
  const subscriptionSnapshot = useSubscriptionStore.getState();
  const subscriptionByOrgId: Record<string, BillingSubscription> = currency
    ? { [ORG_ID]: { orgId: ORG_ID, plan: 'business', currency } }
    : {};
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useSubscriptionStore.setState({ subscriptionByOrgId, status: 'loaded' });
  return () => {
    useOrgStore.setState(orgSnapshot);
    useSubscriptionStore.setState(subscriptionSnapshot);
  };
};

/**
 * Every service accordion is the only thing in the card carrying
 * `aria-expanded`, so this is the service list in document order - which is the
 * order both of the card's index-based writers depend on.
 */
const serviceNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('button[aria-expanded]')).map((node) =>
    node.getAttribute('aria-label')
  );

/**
 * Two specialities, rendered the way `AddSpeciality` renders them: one card per
 * row, all sharing a single `formData` array, each told only its own index.
 * `setFormData` has to be real state for any of the card's writes to be visible,
 * and a second card has to be on screen for a write that escapes its own index
 * to be visible at all.
 */
const DraftPair = () => {
  const [draft, setDraft] = useState<SpecialityWeb[]>([
    speciality('Cardiology', [
      service('Heart Check-up', { durationMinutes: 20, cost: 60, maxDiscount: 10 }),
      service('ECG / Echocardiogram', { durationMinutes: 30, cost: 90, maxDiscount: 10 }),
    ]),
    speciality('Ophthalmology', [
      service('Eye Examination', { durationMinutes: 40, cost: 80, maxDiscount: 10 }),
      service('Glaucoma Testing', { durationMinutes: 50, cost: 85, maxDiscount: 10 }),
    ]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {draft.map((item, index) => (
        <div key={item.name} className="flex flex-col gap-2">
          <p className="text-body-3-emphasis text-[var(--ink)]">{item.name}</p>
          <SpecialityCard setFormData={setDraft} speciality={item} index={index} />
        </div>
      ))}
    </div>
  );
};

const meta = {
  title: 'Organization/SpecialityCard',
  component: SpecialityCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The body of one speciality inside the "Add specialties" panel: a service search over one ' +
          'editable accordion per service. It owns both writers for the draft - the per-field ' +
          'update and the removal - and both address the draft by **two indices**, the ' +
          "speciality's position in `formData` and the service's position within it. Neither is " +
          'checked against a name or an id, so a write that lands on the wrong row produces a ' +
          'perfectly ordinary-looking card.\n\n' +
          'Everything it renders is uncontrolled by any store except one word: the currency in the ' +
          "**Service charge** label comes from the primary organisation's subscription and falls " +
          'back to USD, so the same card reads differently for a euro-billed practice.\n\n' +
          '`removeService` is wired to each accordion but cannot be reached: the accordions are ' +
          'rendered with `isEditing`, and `Accordion` gates its trash on `showDeleteIcon && ' +
          '!isEditing`. The stories assert that absence rather than pretending the affordance is ' +
          'there - a service added by mistake can only be got rid of by deleting the whole ' +
          'speciality from the panel above.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    setFormData: { table: { disable: true } },
  },
  args: {
    speciality: OBSERVATIONAL_TOOLS,
    index: 0,
    // A sink for the read-only frames. The stories that assert a write render
    // `DraftPair` instead, which supplies a real `useState` setter.
    setFormData: fn() as React.Dispatch<React.SetStateAction<SpecialityWeb[]>>,
  },
  beforeEach: withCurrency(),
} satisfies Meta<typeof SpecialityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoServices: Story = {
  name: 'A speciality with no services',
  args: { speciality: speciality('Observational tools') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The state every speciality starts in: the search, and nothing under it.
    await expect(
      canvas.getByRole('textbox', { name: 'Search or create service' })
    ).toBeInTheDocument();
    await expect(serviceNames(canvasElement)).toEqual([]);
    await expect(canvas.queryByLabelText('Description')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the card opens for a speciality picked out of the search: `services` is undefined, ' +
          'not an empty array, and the optional chain renders nothing rather than an empty-state ' +
          'line. There is no count and no prompt - the search is the whole instruction.',
      },
    },
  },
};

export const WithServices: Story = {
  name: 'Three services, all open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every service is its own accordion, in array order, and each one is open
    // from the first render - there is no "expand all" to reach the fields.
    await expect(serviceNames(canvasElement)).toEqual([
      'Feline Grimace Scale',
      'Canine Acute Pain Scale',
      'Equine Grimace Scale',
    ]);
    const expanded = Array.from(canvasElement.querySelectorAll('button[aria-expanded]')).map(
      (node) => node.getAttribute('aria-expanded')
    );
    await expect(expanded).toEqual(['true', 'true', 'true']);

    /* All four fields of the first service, read as a set. Three of them are
       numeric inputs of the same shape sitting in the same block, so a field
       bound to the wrong key of `Service` still renders a plausible number -
       distinct fixture values are what make that visible. */
    await expect(canvas.getAllByLabelText('Description')[0]).toHaveValue(
      'Feline Grimace Scale for observational tools workflows in your hospital organization.'
    );
    await expect(canvas.getAllByLabelText('Duration (mins)')[0]).toHaveValue(20);
    await expect(canvas.getAllByLabelText('Service charge (USD)')[0]).toHaveValue(65);
    await expect(canvas.getAllByLabelText('Max discount (%)')[0]).toHaveValue(15);

    /* And no way to take a service back out. `removeService` is passed to every
       accordion, but `isEditing` suppresses the trash that would call it, so the
       handler is unreachable from here. Asserted per service rather than once,
       because the gate is evaluated per accordion. */
    for (const name of [
      'Feline Grimace Scale',
      'Canine Acute Pain Scale',
      'Equine Grimace Scale',
    ]) {
      await expect(
        canvas.queryByRole('button', { name: `Delete ${name}` })
      ).not.toBeInTheDocument();
      await expect(canvas.queryByRole('button', { name: `Edit ${name}` })).not.toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The working frame. Three services means twelve inputs open at once, which is why the ' +
          'panel around this card scrolls: nothing here collapses on its own after a service is ' +
          'added.',
      },
    },
  },
};

export const EuroCurrency: Story = {
  name: 'A euro-billed organisation',
  beforeEach: withCurrency('EUR'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The only string on the card that is not the service's own data. It is
       interpolated into the label, so it is also the accessible name of the
       field - a currency that failed to resolve would leave "Service charge
       (undefined)" on screen and in the label, and every other assertion in this
       file would still pass. */
    await expect(canvas.getAllByLabelText('Service charge (EUR)')).toHaveLength(3);
    await expect(canvas.queryByLabelText('Service charge (USD)')).not.toBeInTheDocument();
    // The amount is unconverted: only the label changes.
    await expect(canvas.getAllByLabelText('Service charge (EUR)')[0]).toHaveValue(65);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The subscription currency reaches the field label but not the number: charges are ' +
          'stored and shown as typed, so switching a practice between currencies re-labels every ' +
          'price without repricing anything.',
      },
    },
  },
};

export const EditingScopesToOneService: Story = {
  name: 'Editing writes to one row only',
  render: () => <DraftPair />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const durations = () => canvas.getAllByLabelText('Duration (mins)');

    // Two specialities, two services each, four distinct durations.
    await expect(durations().map((input) => (input as HTMLInputElement).value)).toEqual([
      '20',
      '30',
      '40',
      '50',
    ]);

    // The last field on screen: the second service of the second speciality, so
    // a write that loses either index lands somewhere visible.
    const target = durations()[3];
    await userEvent.clear(target);
    await userEvent.type(target, '55');

    /* `updateServiceField` rebuilds the whole `formData` array on every
       keystroke, keeping the untouched specialities by reference and mapping the
       touched one's services by position. Asserted as the full list of four:
       "the field I typed in now says 55" is also true when the other three were
       overwritten with it. */
    await expect(durations().map((input) => (input as HTMLInputElement).value)).toEqual([
      '20',
      '30',
      '40',
      '55',
    ]);
    // The neighbouring fields of the same service are untouched too - the update
    // replaces one key, not the whole service.
    await expect(canvas.getAllByLabelText('Service charge (USD)')[3]).toHaveValue(85);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two cards sharing one `formData`, which is how the panel above renders them. The value ' +
          'goes into the draft as the raw input **string** - `durationMinutes` and `cost` are ' +
          'typed as numbers, and nothing converts them back before the save builds its payload.',
      },
    },
  },
};
