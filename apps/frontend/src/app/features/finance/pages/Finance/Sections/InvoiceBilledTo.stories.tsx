import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { StoredParent } from '@/app/features/companions/pages/Companions/types';
import { useParentStore } from '@/app/stores/parentStore';
import InvoiceBilledTo from './InvoiceBilledTo';

const PARENT_ID = 'parent-sky-doe';

const FULL_PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Sky',
  lastName: 'Doe',
  email: 'sky.doe@example.com',
  phoneNumber: '+44 7700 900142',
  address: {
    addressLine: '14 Fell Lane',
    city: 'Keswick',
    postalCode: 'CA12 4DP',
    country: 'GB',
  },
  createdFrom: 'pms',
};

/**
 * One of everything missing: no surname, no street, no postcode, no phone. Each
 * absence sits on the far side of a different separator, which is the whole
 * point of the story - see the play function.
 */
const PARTIAL_PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Sky',
  email: 'sky.doe@example.com',
  address: { city: 'Keswick' },
  createdFrom: 'pms',
};

/**
 * `getAppointmentCompanion(...).parent` is typed `{ id, name }` and nothing
 * more, so the appointment fallback can only ever produce a NAME - never an
 * address and never a contact line. The name is deliberately different from the
 * stored parent's so the precedence story can tell which source won.
 */
const patient: Appointment['patient'] = {
  id: 'companion-kizie',
  name: 'Kizie',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: PARENT_ID, name: 'S. Doe (from booking)' },
};

// Local-time Dates rather than UTC literals: a `...T09:30:00.000Z` fixture slides
// by the runner's offset, which is how a fixture starts passing by timezone.
const APPOINTMENT: Appointment = {
  id: 'appointment-8842',
  organisationId: 'org-avenger-park',
  patient,
  companion: patient,
  appointmentDate: new Date(2026, 7, 12, 9, 30),
  startTime: new Date(2026, 7, 12, 9, 30),
  endTime: new Date(2026, 7, 12, 10, 0),
  timeSlot: '09:30 AM',
  durationMinutes: 30,
  status: 'COMPLETED',
};

/**
 * The card reads the payer straight out of `parentStore` - no hook here fetches
 * on read, so seeding the store IS the whole of the setup and the component
 * under review is the real one with nothing stubbed. The previous state is
 * restored on unmount so neighbouring stories are unaffected.
 */
const seedParents = (parents: StoredParent[]) => () => {
  const snapshot = useParentStore.getState();
  useParentStore.setState({
    parentsById: Object.fromEntries(parents.map((parent) => [parent.id, parent])),
    parentIds: parents.map((parent) => parent.id),
    status: 'loaded',
  });
  return () => {
    useParentStore.setState(snapshot);
  };
};

/**
 * The card is a flat list of spans - the "Billed to" label, then whichever of
 * name / address / contact survived. Reading the children POSITIONALLY is what
 * makes an absent line assertable: a text query can only say a string is gone,
 * not that the line it belonged to was never emitted.
 */
const lines = (region: HTMLElement): string[] =>
  [...region.children].map((child) => child.textContent ?? '');

const meta = {
  title: 'Finance/InvoiceBilledTo',
  component: InvoiceBilledTo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The payer block on the invoice drawer. It resolves its record from up to two sources in ' +
          'order: the stored parent for `parentId`, then the parent hanging off the appointment. ' +
          'Those are not equivalent - `parentStore` holds a full record, while the appointment ' +
          'carries only `{ id, name }` - so the fallback is a strictly poorer card rather than the ' +
          'same card from elsewhere, and which one won is invisible in a screenshot.\n\n' +
          'Every visible line is assembled by `joinTruthy`, which drops empties BEFORE it joins. ' +
          'That is the detail the stories guard: a half-filled record must not print "Sky ", ' +
          '", Keswick" or an email with a trailing middle dot. Nothing here is a required field ' +
          'in practice, so the half-filled record is the common case, not the edge one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    parentId: PARENT_ID,
  },
  decorators: [
    // The drawer gives this card the narrow right-hand column, which is where
    // the address line has to fit.
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: seedParents([FULL_PARENT]),
} satisfies Meta<typeof InvoiceBilledTo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromStore: Story = {
  name: 'Stored parent wins over the booking',
  args: { appointment: APPOINTMENT },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed to' });

    /* Label plus three lines, in this order and no other. The address is the
       one that has to be read whole: postcode BEFORE city inside the second
       clause, comma between street and locality. Swapping those two still
       renders a plausible-looking address, which is exactly why it is compared
       as an exact string rather than by searching for "Keswick". */
    await expect(lines(region)).toEqual([
      'Billed to',
      'Sky Doe',
      '14 Fell Lane, CA12 4DP Keswick',
      'sky.doe@example.com · +44 7700 900142',
    ]);

    /* Both sources were available and the stored record won. Without this the
       precedence is untestable: both branches produce "a name", so a broken
       order would keep rendering a card that looks right and bills the wrong
       version of the payer. */
    await expect(region.textContent).not.toContain('from booking');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The complete card, and the only state that shows all three lines. The appointment is ' +
          'passed too, carrying a deliberately different name, so the story proves the stored ' +
          'record takes precedence rather than merely that a name appeared.',
      },
    },
  },
};

export const FromAppointment: Story = {
  name: 'Falls back to the booking',
  args: { appointment: APPOINTMENT },
  // The invoice knows its `parentId`, but `parentStore` has not loaded that
  // parent - the ordinary state on a cold open of the drawer, and the only way
  // to reach the fallback with a `parentId` present.
  beforeEach: seedParents([]),
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed to' });

    /* Two children, not four: the appointment's parent has no address and no
       contact, so those lines are never emitted. A text query would report the
       same thing for an empty line as for an absent one, and an empty grey line
       under a name reads as a rendering fault. */
    await expect(lines(region)).toEqual(['Billed to', 'S. Doe (from booking)']);

    // A name is enough to count as details, so the empty-state prose stays away.
    await expect(region.textContent).not.toContain('No billing contact on file.');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the drawer shows before the parent list arrives, or for a parent that was never ' +
          'stored. The card is a name and nothing else - worth seeing beside the full card, ' +
          'because the missing address here is a data-availability state rather than an empty ' +
          'address on file.',
      },
    },
  },
};

export const PartialRecord: Story = {
  name: 'Half-filled record keeps its separators clean',
  beforeEach: seedParents([PARTIAL_PARENT]),
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed to' });

    /* Three separators, each with one side missing: no surname after the space,
       no street before the comma, no phone after the middle dot. Compared as
       exact strings because the failure is trailing punctuation, and every
       text-matching query normalises whitespace away - `getByText('Sky')` passes
       just as happily on "Sky ". */
    await expect(lines(region)).toEqual(['Billed to', 'Sky', 'Keswick', 'sky.doe@example.com']);

    // The clearest single symptom, stated outright: no orphaned middle dot.
    await expect(region.textContent).not.toContain('·');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Only `firstName` and `email` are ever guaranteed on a parent record, so this shape is ' +
          'routine rather than exotic. It is the story that would catch a refactor of `joinTruthy` ' +
          'into a plain `.join()`, which renders correctly for a complete record and leaves ' +
          'dangling punctuation on every incomplete one.',
      },
    },
  },
};

export const NoContact: Story = {
  name: 'Nothing to bill to',
  args: { parentId: undefined, appointment: undefined },
  beforeEach: seedParents([]),
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed to' });

    /* The card keeps its heading and states the gap in prose. Asserted as the
       complete child list so an accidental extra empty span cannot hide under a
       passing text match. */
    await expect(lines(region)).toEqual(['Billed to', 'No billing contact on file.']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An over-the-counter sale with no appointment and no parent on it. The card stays rather ' +
          'than disappearing, because a missing payer on a billing document is information, and a ' +
          'silently absent card looks like a layout bug instead.',
      },
    },
  },
};
