import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import Parent from './Parent';

const ORG_ID = 'org-parent-section-story';

/* Local date parts rather than a `...Z` literal: nothing here formats a date, but
   the fixture is shared with the companion record and a UTC literal slides a day
   west of Greenwich the moment somebody does. */
const DOB = new Date(2021, 3, 18);

/** Only `companion.parent` is read; the companion half is here to satisfy the type. */
const COMPANION: StoredCompanion = {
  id: 'companion-1',
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: DOB,
  gender: 'female',
  isInsured: false,
};

const parent = (overrides: Partial<StoredParent> = {}): StoredParent => ({
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 901820',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
  ...overrides,
});

const record = (overrides: Partial<StoredParent> = {}): CompanionParent => ({
  companion: COMPANION,
  parent: parent(overrides),
});

/** The eight labels the pane declares, in the order `Fields` lists them. */
const FIELD_LABELS = [
  'First name',
  'Last name',
  'Email',
  'Phone number',
  'Address line',
  'City',
  'State / Province',
  'Postal code',
];

/**
 * The value beside a label. `FieldValueRow` is a two-child flex, so the value is
 * the row's last element - reading it by position rather than by text is what
 * lets a story assert a dash without matching one of the other seven rows.
 */
const rowValue = (canvasElement: HTMLElement, label: string): string => {
  const labelNode = within(canvasElement).getByText(label);
  const row = labelNode.parentElement as HTMLElement;
  return (row.lastElementChild as HTMLElement).textContent ?? '';
};

const meta = {
  title: 'Companions/Sections/Parent',
  component: Parent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "parent information" pane of the companion record: one `EditableAccordion` over a ' +
          'flattened copy of `companion.parent`.\n\n' +
          '**It can never be edited.** The accordion is mounted with `showEditIcon={false}`, and ' +
          'that is the only affordance `Accordion` offers - there is no `ref`, no `rightElement` ' +
          'and no footer, so nothing can call `startEditing`. The `required` flags on first and ' +
          'last name, the `editable: false` on the other six fields, the `onSave` handler and the ' +
          '`updateParent` call behind it are therefore all unreachable from this pane. The stories ' +
          'pin that rather than describe it: every one of them asserts the pencil and the inputs ' +
          'are absent.\n\n' +
          "The address is flattened in a `useMemo` with `?? ''` per part, so a parent with no " +
          '`address` still renders four rows. Empty string and `undefined` both reach ' +
          '`formatDisplayValue` as a dash, which is why the fallback changes nothing a reader can ' +
          'see - drawn below so the next person does not have to work that out from the source.\n\n' +
          'Rendered at 530px, the width of the drawer `CompanionInfo` opens it inside.',
      },
    },
  },
  tags: ['autodocs'],
  args: { companion: record() },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[530px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Parent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A parent with a full address',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `defaultOpen` is true, so the rows are on screen without a click. The
    // pane is the second half of a drawer that is already scrolled to it.
    await expect(canvas.getByRole('button', { name: 'Parent information' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    for (const label of FIELD_LABELS) {
      await expect(canvas.getByText(label)).toBeVisible();
    }

    /* The four address rows come from the flattening memo, not from the parent
       record itself - `address.city` is read as `city`. A memo that stopped
       spreading would leave four dashes here and nothing else would complain. */
    await expect(rowValue(canvasElement, 'Address line')).toBe('Wallstrasse 14');
    await expect(rowValue(canvasElement, 'City')).toBe('Berlin');
    await expect(rowValue(canvasElement, 'State / Province')).toBe('Berlin');
    await expect(rowValue(canvasElement, 'Postal code')).toBe('10179');
    await expect(rowValue(canvasElement, 'Email')).toBe('lena.hartmann@example.com');

    /* `country` is on the address and is NOT one of the eight fields, so the
       pane shows a German address with no country on it. Asserting the absence
       is the only way that stays visible - adding the row would be a one-line
       change nobody would notice was missing. */
    await expect(canvas.queryByText('Germany')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Country')).not.toBeInTheDocument();

    /* No pencil and no inputs: `showEditIcon={false}` removes the only way in.
       Both halves matter - the button being gone is what makes the accordion
       read-only, and the absence of a textbox is what proves no other route
       (footer, ref, right element) opened the editor instead. */
    await expect(
      canvas.queryByRole('button', { name: 'Edit Parent information' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    // And with no edit mode there is no inline action row either.
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  },
};

export const NoAddress: Story = {
  name: 'A parent with no address on file',
  args: { companion: record({ address: undefined as never }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Parents created from a mobile signup arrive without an address. The four
       rows still render - that is the `?? ''` in the memo - and each falls to
       the dash every other row in PIMS uses. Without the fallback the optional
       chain yields `undefined`, which formats to the same dash, so this story
       is also the evidence that the fallback is cosmetic. */
    for (const label of ['Address line', 'City', 'State / Province', 'Postal code']) {
      await expect(rowValue(canvasElement, label)).toBe('-');
    }

    // The contact rows above are untouched, so the pane reads as an incomplete
    // record rather than a failed one.
    await expect(rowValue(canvasElement, 'First name')).toBe('Lena');
    await expect(rowValue(canvasElement, 'Email')).toBe('lena.hartmann@example.com');

    // Still nothing to press, so the missing address cannot be filled in here.
    await expect(
      canvas.queryByRole('button', { name: 'Edit Parent information' })
    ).not.toBeInTheDocument();
  },
};

export const SparseRecord: Story = {
  name: 'Optional fields left unset',
  args: { companion: record({ lastName: undefined, phoneNumber: undefined }) },
  play: async ({ canvasElement }) => {
    /* `lastName` and `phoneNumber` are optional on `Parent` and reach the row
       as `undefined` rather than as the empty string the address parts get.
       Both paths land on the same dash, which is the point: the pane has one
       "not set" rendering, so a reader cannot tell a missing address from a
       missing surname - and neither can be fixed from here. */
    await expect(rowValue(canvasElement, 'Last name')).toBe('-');
    await expect(rowValue(canvasElement, 'Phone number')).toBe('-');

    // `firstName` is the only name the record is guaranteed to have.
    await expect(rowValue(canvasElement, 'First name')).toBe('Lena');
    await expect(rowValue(canvasElement, 'City')).toBe('Berlin');
  },
};

export const Phone: Story = {
  name: 'Phone: a long email stays inside its row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    companion: record({
      email: 'lena.hartmann-schmidt@tierarztpraxis-friedrichshain.example.com',
      address: {
        addressLine: 'Wallstrasse 14, Vorderhaus, 3. Obergeschoss links',
        city: 'Berlin',
        state: 'Berlin',
        postalCode: '10179',
        country: 'Germany',
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const email = within(canvasElement).getByText(
      'lena.hartmann-schmidt@tierarztpraxis-friedrichshain.example.com'
    );
    const row = email.parentElement as HTMLElement;

    /* The row is a `justify-between` flex with a right-aligned value and no
       wrap control of its own, so a long value has to give up width inside the
       row rather than push past its edge. At 375px this is the value that
       decides whether the drawer scrolls sideways. */
    await expect(email.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right + 1
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
