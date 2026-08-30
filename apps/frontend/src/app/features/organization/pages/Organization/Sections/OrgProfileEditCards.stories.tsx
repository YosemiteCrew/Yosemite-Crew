import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import type { OrgProfileForm } from './useOrgProfileForm';
import OrgProfileEditCards from './OrgProfileEditCards';

const ORG_ID = 'org-storybook-editcards';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  DUNSNumber: '15-048-3782',
  isVerified: true,
  isActive: true,
  address: {
    addressLine: '18 Larkspur Way',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
  appointmentCheckInBufferMinutes: 10,
  appointmentCheckInRadiusMeters: 150,
};

const membership: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

/**
 * A fresh `OrgProfileForm` per story: the three handlers are separate spies, so
 * "the Address card saved" can be told apart from "some card saved". Built by a
 * factory rather than shared, because one shared trio would let a call made by an
 * earlier story satisfy a later assertion.
 */
const buildForm = (formData: Organisation = ORG): OrgProfileForm => ({
  formData,
  handleOrgSave: fn(),
  handleAddressSave: fn(),
  handleCheckInSave: fn(),
});

/**
 * The `label | value` row that owns a label cell, given the label element.
 *
 * `FieldValueRow` is a flex row of exactly two divs, so the label's parent IS the
 * row. Asserting the row text rather than two loose `getByText`s is what proves
 * the PAIRING - and it is load-bearing here: all three cards render from the one
 * form object, and the fixture deliberately has "Berlin" as both the state and
 * the city, so a value drawn under the wrong label leaves every existence
 * assertion passing.
 */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

/** The card that owns a title cell: title -> header row -> card root. */
const cardOf = (title: HTMLElement): HTMLElement =>
  title.parentElement?.parentElement as HTMLElement;

/** Exactly the twelve field labels across the three cards, and nothing else. */
const ALL_LABELS =
  /^(Organization type|Organization name|Tax ID|Country|DUNS number|Phone number|Address line|State \/ Province|City|Postal code|Enable check-in this many minutes before start|Maximum check-in distance \(meters\))$/;

/**
 * Seeds the org store rather than mocking hooks. Each `ProfileCard` underneath
 * reads `usePrimaryOrg` for the id it hands its two logo endpoints - without it
 * `LogoUpdator` renders permanently disabled, which is a different picture from
 * the one the product shows.
 */
const seedOrg = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'Organization/OrgProfileEditCards',
  component: OrgProfileEditCards,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The organization edit surface, shared by the desktop Profile band and the phone ' +
          'Organization screen so both reveal the same three cards over one set of save ' +
          'handlers.\n\n' +
          'It is a fragment, not a wrapper: the three `ProfileCard`s land as direct children of ' +
          "whatever column renders it, and inherit that column's gap (14px on desktop, 11px on " +
          'the phone). Adding a wrapper div here changes the spacing on both surfaces at once.\n\n' +
          'Two things happen in this file that happen nowhere else. `canEditOrg` gates each ' +
          '`onSave` **individually** - passing `undefined` rather than hiding anything - so a ' +
          'viewer keeps every value on screen and loses only the pencil. And the third card is ' +
          'given `appointmentCheckInBufferMinutes ?? 5` / `appointmentCheckInRadiusMeters ?? 200`, ' +
          'so an org that has never configured check-in still reads as 5 minutes and 200 meters ' +
          'instead of blank rows.\n\n' +
          'The split of the org record across the cards is also decided here: `country` is lifted ' +
          'out of `formData.address` onto the Organization card, because `BasicFields` addresses ' +
          'it by a top-level key, which leaves the Address card with four fields and no country.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    form: buildForm(),
    canEditOrg: true,
  },
  decorators: [
    (Story) => (
      // The desktop column: `flex flex-col gap-[14px]` is what Profile.tsx wraps
      // this in, and the gap only lands because the component returns a fragment.
      <div className="flex w-[720px] max-w-full flex-col gap-[14px] bg-[var(--page)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedOrg,
} satisfies Meta<typeof OrgProfileEditCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Editable (org:edit)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three cards, in this order, each resting with its own pencil. The order is
       the assertion that matters: this component is the only place it is decided,
       and both surfaces inherit whatever it does. */
    const pencils = canvas.getAllByRole('button', { name: /^Edit / });
    await expect(pencils.map((pencil) => pencil.getAttribute('aria-label'))).toEqual([
      'Edit Organization',
      'Edit Address',
      'Edit Check-in settings',
    ]);

    const orgCard = cardOf(canvas.getByText('Organization'));
    const addressCard = cardOf(canvas.getByText('Address'));
    const checkInCard = cardOf(canvas.getByText('Check-in settings'));

    // Each pencil belongs to its own card - the labels above would still read
    // correctly if a title and its save handler had drifted apart.
    await expect(within(orgCard).getByRole('button', { name: 'Edit Organization' })).toBeVisible();
    await expect(within(addressCard).getByRole('button', { name: 'Edit Address' })).toBeVisible();
    await expect(
      within(checkInCard).getByRole('button', { name: 'Edit Check-in settings' })
    ).toBeVisible();

    /* No wrapper element: the three cards are siblings under the caller's column,
       which is the only reason its gap applies to them. A wrapper div added here
       silently collapses the spacing on the desktop band and the phone screen at
       the same time. */
    await expect(orgCard.parentElement).toBe(addressCard.parentElement);
    await expect(orgCard.parentElement?.children).toHaveLength(3);

    /* `country` is lifted out of `formData.address` onto the Organization card and
       is deliberately absent from the Address card. Asserted as a row, not as a
       text, because "Germany" existing somewhere on screen is not the claim. */
    await expect(rowOf(within(orgCard).getByText('Country')).textContent).toBe('CountryGermany');
    await expect(within(addressCard).queryByText('Country')).toBeNull();

    /* The state and the city are both "Berlin" in this fixture on purpose: the two
       rows are indistinguishable by value, so only the pairing catches a swap. */
    await expect(rowOf(within(addressCard).getByText('State / Province')).textContent).toBe(
      'State / ProvinceBerlin'
    );
    await expect(rowOf(within(addressCard).getByText('City')).textContent).toBe('CityBerlin');
    await expect(rowOf(within(addressCard).getByText('Postal code')).textContent).toBe(
      'Postal code10405'
    );
    await expect(rowOf(within(orgCard).getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
    await expect(
      rowOf(within(checkInCard).getByText('Maximum check-in distance (meters)')).textContent
    ).toBe('Maximum check-in distance (meters)150');

    // Twelve rows across the three cards, and every card is resting: nothing is
    // an input yet and there is no action row anywhere.
    await expect(canvas.getAllByText(ALL_LABELS)).toHaveLength(12);
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();

    /* `showProfile` defaults to true, so the name is drawn twice: once in the
       identity band at the top of the first card, once as its own row below. The
       read-only-band story asserts the same name at one. */
    await expect(canvas.getAllByText('Sunrise Veterinary Hospital')).toHaveLength(2);
    await expect(canvas.getByText('Verified')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What an owner or an admin sees. All three cards rest closed with a pencil each, so ' +
          'opening one is a second click - this screen never shows a form on arrival.',
      },
    },
  },
};

export const AddressSavesThroughItsOwnHandler: Story = {
  name: 'Each card saves through its own handler',
  args: { form: buildForm() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Address' }));

    /* Four editable address fields, one of them the Google address search, which
       renders as a plain textbox until it is typed into. Only one card is open, so
       there is exactly one Save on screen. */
    const city = await canvas.findByRole('textbox', { name: 'City' });
    await expect(canvas.getAllByRole('textbox')).toHaveLength(4);
    await userEvent.clear(city);
    await userEvent.type(city, 'Potsdam');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* An exact object, not `objectContaining`: the payload has to be the four
       address keys and nothing else. The three cards share one form object, so the
       failure this guards against is a card handing its neighbour's fields up -
       `handleAddressSave` spreads what it receives straight into `formData.address`,
       where a stray `taxId` would be written into the address sub-document. */
    await waitFor(() =>
      expect(args.form.handleAddressSave).toHaveBeenCalledWith({
        addressLine: '18 Larkspur Way',
        state: 'Berlin',
        city: 'Potsdam',
        postalCode: '10405',
      })
    );
    await expect(args.form.handleOrgSave).not.toHaveBeenCalled();
    await expect(args.form.handleCheckInSave).not.toHaveBeenCalled();

    // The card closes itself on a resolved save and the edited value stays on
    // screen: the parent has not sent a new `formData` down at this point.
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull());
    await expect(rowOf(canvas.getByText('City')).textContent).toBe('CityPotsdam');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The wiring worth checking, because all three cards look alike and are constructed ' +
          'four lines apart. Country is the trap: it is edited on the Organization card, so ' +
          '`handleOrgSave` folds it back into `address` while `handleAddressSave` never sees it.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no org:edit)',
  args: { canEditOrg: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Not one pencil, on any of the three cards: `onSave` is `undefined`, and
       `ProfileCard` treats a missing handler as "not editable" rather than
       rendering a control that would fail later. */
    await expect(canvas.queryAllByRole('button', { name: /^Edit / })).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).toBeNull();

    /* Every value is still readable - this is the point of gating the handler
       instead of the card. A viewer loses the pencil, not the organization. */
    await expect(canvas.getAllByText(ALL_LABELS)).toHaveLength(12);
    await expect(rowOf(canvas.getByText('Phone number')).textContent).toBe(
      'Phone number4155550110'
    );
    await expect(rowOf(canvas.getByText('Country')).textContent).toBe('CountryGermany');
    await expect(canvas.getByText('Verified')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state only this component produces: three read-only `ProfileCard`s. Nothing else ' +
          'in the app renders one, because every other caller passes a handler unconditionally.',
      },
    },
  },
};

export const WithoutIdentityBand: Story = {
  name: 'showProfile false',
  args: { showProfile: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `showProfile` only ever reaches the first card, so the logo tile, the
       verification pill and the duplicated name go and the twelve rows stay. The
       name at ONE is the assertion - at two, the band is still mounted. */
    await expect(canvas.getAllByText('Sunrise Veterinary Hospital')).toHaveLength(1);
    await expect(canvas.queryByText('Verified')).toBeNull();
    await expect(canvas.getAllByText(ALL_LABELS)).toHaveLength(12);

    // The remaining name is the row, not a leftover heading.
    await expect(rowOf(canvas.getByText('Organization name')).textContent).toBe(
      'Organization nameSunrise Veterinary Hospital'
    );
    // The pencils are untouched by `showProfile`: it hides a band, not the edit
    // affordance, which is `canEditOrg`'s job.
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Organization card without its identity band. Nothing passes `showProfile={false}` ' +
          'today - both callers take the default - so this is the state to look at before ' +
          'reaching for it: the card loses its only picture and opens straight onto label rows.',
      },
    },
  },
};

export const CheckInDefaults: Story = {
  name: 'Check-in defaults for an org that has none',
  args: {
    form: buildForm({
      ...ORG,
      appointmentCheckInBufferMinutes: undefined,
      appointmentCheckInRadiusMeters: undefined,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkInCard = cardOf(canvas.getByText('Check-in settings'));

    /* 5 and 200 come from this file, not from the record and not from the API - a
       nullish coalesce two lines apart in the same JSX. Without them the rows read
       "-" and the org looks misconfigured rather than merely unconfigured. The
       existing unit test stubs `ProfileCard` out entirely, so these two numbers
       are asserted nowhere else. */
    await expect(
      rowOf(within(checkInCard).getByText('Enable check-in this many minutes before start'))
        .textContent
    ).toBe('Enable check-in this many minutes before start5');
    await expect(
      rowOf(within(checkInCard).getByText('Maximum check-in distance (meters)')).textContent
    ).toBe('Maximum check-in distance (meters)200');

    /* Opening the card carries the same defaults into the inputs, so saving
       without touching anything writes 5/200 rather than clearing the fields.
       Number fields are spinbuttons, not textboxes. */
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Check-in settings' }));
    await expect(
      await canvas.findByRole('spinbutton', {
        name: 'Enable check-in this many minutes before start',
      })
    ).toHaveValue(5);
    await expect(
      canvas.getByRole('spinbutton', { name: 'Maximum check-in distance (meters)' })
    ).toHaveValue(200);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Zero is a legitimate value for both of these, so the fallback is a nullish coalesce ' +
          'rather than a truthiness check - an org that has deliberately set a 0 minute buffer ' +
          'keeps it and does not silently get 5 back.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the same three cards at 375px',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    (Story) => (
      // The phone column from PhoneOrganization: a tighter gap and an 18px inset.
      <div className="flex flex-col gap-[11px] bg-[var(--page)] px-[18px]! py-[14px]!">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);

    /* The long check-in labels are the ones that push a card wide: they sit in a
       flex row opposite their value with only a 12px gap, inside a 375px viewport
       that has already lost 36px to the page inset. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    const label = canvas.getByText('Enable check-in this many minutes before start');
    const row = rowOf(label);
    await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The phone Organization screen swaps its whole body for these three cards, so this is ' +
          'the width where the two check-in labels have to wrap rather than shove their values ' +
          'off the card.',
      },
    },
  },
};
