import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment, Organisation } from '@yosemite-crew/types';

import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import Companion from './Companion';

const ORG_ID = 'org-appointment-companion-story';
const COMPANION_ID = 'companion-1';
const PARENT_ID = 'parent-1';

/* The Date of birth row formats through `Intl` in the ORG's preferred timezone
   (Europe/Berlin until someone picks another), not the runner's, so the fixture
   is anchored to a UTC instant at midday. A local-midnight Date would be a
   different calendar day once it is re-read in Berlin and the assertion below
   would pass or fail by machine. */
const DATE_OF_BIRTH = new Date(Date.UTC(2019, 4, 14, 12, 0));

/**
 * The appointment's embedded parent. `Appointment['patient']['parent']` only
 * declares `id` and `name`, but the API sends the whole contact block and
 * `Companion` casts it back out again to use as its fallback - so the fixture
 * has to carry the wider shape or the fallback branch has nothing to fall back
 * to.
 */
type EmbeddedParent = Appointment['patient']['parent'] & {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

/* Deliberately a STALE copy of the contact details: different email, different
   phone, different address from the parent record in the store. That is the
   only way to prove which of the two the section actually renders. */
const EMBEDDED_PARENT: EmbeddedParent = {
  id: PARENT_ID,
  name: 'Lena Hartmann',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 555 0134',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
};

/** What the appointment carries when the booking never captured the contact block. */
const NAME_ONLY_PARENT: Appointment['patient']['parent'] = {
  id: PARENT_ID,
  name: 'Lena Hartmann',
};

const buildAppointment = (parent: Appointment['patient']['parent']): Appointment => ({
  id: 'appt-companion-info-1',
  patient: {
    id: COMPANION_ID,
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent,
  },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
});

const COMPANION_RECORD: StoredCompanion = {
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: PARENT_ID,
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: DATE_OF_BIRTH,
  gender: 'female',
  currentWeight: 12.4,
  bloodGroup: 'DEA 1.1 negative',
  allergy: 'Chicken protein',
  isneutered: true,
  isInsured: true,
  insurance: {
    isInsured: true,
    companyName: 'Harbourside Pet Cover',
    policyNumber: 'HPC-88213',
  },
};

const PARENT_RECORD: StoredParent = {
  id: PARENT_ID,
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena@larkspur-owners.example',
  phoneNumber: '+49 30 555 0199',
  address: {
    addressLine: 'Gartenstrasse 7',
    city: 'Potsdam',
    state: 'Brandenburg',
    postalCode: '14467',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const buildOrg = (type: Organisation['type']): Organisation => ({
  _id: ORG_ID,
  name: 'Larkspur Boarding',
  type,
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-2291',
});

/** Where `getCompanionTerminologyForOrg` looks up the org's chosen noun. */
const TERMINOLOGY_KEY = 'yc_companion_terminology_by_org';

/**
 * Seeds the two record stores, the org (for the terminology hook) and the org's
 * saved companion noun, then puts all four back.
 *
 * Terminology is pinned through the saved preference rather than left to the
 * org-type default, because the default is what an org gets before anyone
 * chooses - and a story that relies on it silently changes meaning the day the
 * ORG_TYPE_DEFAULTS table is edited.
 *
 * Nothing here reaches the network: `Companion` reads both records straight out
 * of the stores and fires no request of its own.
 */
const seed =
  (options: {
    companion: StoredCompanion | null;
    parent: StoredParent | null;
    terminology?: 'COMPANION' | 'PATIENT';
    orgType?: Organisation['type'];
  }) =>
  () => {
    const { companion, parent, terminology = 'COMPANION', orgType = 'BOARDER' } = options;

    const companionSnapshot = useCompanionStore.getState();
    const parentSnapshot = useParentStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const previousTerminology = globalThis.localStorage.getItem(TERMINOLOGY_KEY);

    globalThis.localStorage.setItem(TERMINOLOGY_KEY, JSON.stringify({ [ORG_ID]: terminology }));

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: buildOrg(orgType) },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: companion ? { [companion.id]: companion } : {},
      companionsIdsByOrgId: { [ORG_ID]: companion ? [companion.id] : [] },
      companionIdsByParentId: {},
      status: 'loaded',
    });
    useParentStore.setState({
      parentsById: parent ? { [parent.id]: parent } : {},
      parentIds: parent ? [parent.id] : [],
      status: 'loaded',
    });

    return () => {
      if (previousTerminology === null) {
        globalThis.localStorage.removeItem(TERMINOLOGY_KEY);
      } else {
        globalThis.localStorage.setItem(TERMINOLOGY_KEY, previousTerminology);
      }
      useCompanionStore.setState(companionSnapshot);
      useParentStore.setState(parentSnapshot);
      useOrgStore.setState(orgSnapshot);
    };
  };

const COMPANION_LABELS = [
  'Date of birth',
  'Gender',
  'Weight',
  'Blood group',
  'Neutered status',
  'Allergies',
  'Insurance carrier',
  'Insurance number',
];

const PARENT_LABELS = [
  'First name',
  'Last name',
  'Email',
  'Number',
  'Address line',
  'City',
  'State / Province',
  'Postal code',
];

/**
 * The value beside a label. `FieldValueRow` is a label div and a value div with
 * no roles of their own, so the sibling is the only handle on a single row -
 * and reading the row is what separates "blank" from "-" from a stale value.
 */
const rowValue = (canvasElement: HTMLElement, label: string) =>
  within(canvasElement).getByText(label).nextElementSibling?.textContent ?? '';

const meta = {
  title: 'Appointments/Companion (Info tab)',
  component: Companion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Companion tab inside the appointment detail modal: two read-only accordions built ' +
          'on `EditableAccordion` with `showEditIcon={false}`, so nothing here can be edited even ' +
          'though the underlying primitive is a form.\n\n' +
          'The two halves resolve their data differently, and that is the whole point of this ' +
          'surface. The companion block reads the companion store and nothing else - if the ' +
          'record has not loaded, every row is a dash. The parent block reads the parent store ' +
          'FIRST and falls back per field to the contact details embedded in the appointment, so ' +
          'the same screen can show a mix of the two sources without saying which is which.\n\n' +
          'The companion accordion title runs through `useCompanionTerminologyText`, so it ' +
          'follows the org\'s chosen noun ("Patient details" for a hospital). The parent title is ' +
          'a hard-coded string and never moves.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: buildAppointment(EMBEDDED_PARENT),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[560px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed({ companion: COMPANION_RECORD, parent: PARENT_RECORD }),
} satisfies Meta<typeof Companion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Both records on file',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Companion details' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Parent details' })).toBeInTheDocument();

    /* `showEditIcon={false}` is the only thing making this tab read-only.
       EditableAccordion is a full form underneath, so a flipped flag would hand
       every field an input and a Save button with no `onSave` behind it. */
    await expect(
      canvas.queryByRole('button', { name: 'Edit Companion details' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Edit Parent details' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await expect(rowValue(canvasElement, 'Date of birth')).toBe('May 14, 2019');
    // The stored enum, not a title-cased label: this row prints whatever the
    // record holds, so a backend that starts sending FEMALE shows FEMALE.
    await expect(rowValue(canvasElement, 'Gender')).toBe('female');
    // A bare number - the row carries no unit, so 12.4 could be kg or lb.
    await expect(rowValue(canvasElement, 'Weight')).toBe('12.4');
    await expect(rowValue(canvasElement, 'Blood group')).toBe('DEA 1.1 negative');
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Yes');
    await expect(rowValue(canvasElement, 'Insurance number')).toBe('HPC-88213');

    /* PINS A DEFECT. The companion is insured by "Harbourside Pet Cover" and
       the row still reads "-": `CompanionFields` asks for the key
       `policcompanyNameyNumber`, which no data object has, while
       `CompanionInfoData` publishes the carrier under `companyName`. Nothing
       throws and nothing logs - the row just renders the not-set dash forever.
       When the key is corrected this assertion is what will fail. */
    await expect(rowValue(canvasElement, 'Insurance carrier')).toBe('-');

    /* The parent store wins over the copy embedded in the appointment. The
       fixture's two sources disagree on purpose: the appointment still carries
       lena.hartmann@example.com from the day it was booked. If the precedence
       ever inverted, the screen would keep rendering plausible contact details
       that are simply out of date - the worst kind of wrong for a phone number
       someone is about to ring. */
    await expect(rowValue(canvasElement, 'Email')).toBe('lena@larkspur-owners.example');
    await expect(rowValue(canvasElement, 'Number')).toBe('+49 30 555 0199');
    await expect(rowValue(canvasElement, 'Address line')).toBe('Gartenstrasse 7');
    await expect(rowValue(canvasElement, 'City')).toBe('Potsdam');
    await expect(rowValue(canvasElement, 'Postal code')).toBe('14467');
  },
};

export const ParentRecordMissing: Story = {
  name: 'Parent record not loaded',
  beforeEach: seed({ companion: COMPANION_RECORD, parent: null }),
  play: async ({ canvasElement }) => {
    /* Every parent row now comes off the appointment. The fallback is per FIELD
       rather than per record, so a half-populated store produces a row-by-row
       mix of live and booked-at values with nothing on screen distinguishing
       them - which is why the fixtures disagree and this story asserts the
       embedded set exactly. */
    await expect(rowValue(canvasElement, 'Email')).toBe('lena.hartmann@example.com');
    await expect(rowValue(canvasElement, 'Number')).toBe('+49 30 555 0134');
    await expect(rowValue(canvasElement, 'Address line')).toBe('Wallstrasse 14');
    await expect(rowValue(canvasElement, 'City')).toBe('Berlin');
    await expect(rowValue(canvasElement, 'Postal code')).toBe('10179');
    await expect(rowValue(canvasElement, 'First name')).toBe('Lena');

    // Only the parent half fell back; the companion block is untouched.
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Yes');
    await expect(rowValue(canvasElement, 'Blood group')).toBe('DEA 1.1 negative');
  },
};

export const NeitherRecordLoaded: Story = {
  name: 'Neither record loaded',
  args: { activeAppointment: buildAppointment(NAME_ONLY_PARENT) },
  beforeEach: seed({ companion: null, parent: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Seven of the eight companion rows admit they have nothing. The eighth is
       the interesting one. */
    const blankCompanionRows = COMPANION_LABELS.filter((label) => label !== 'Neutered status');
    for (const label of blankCompanionRows) {
      await expect(rowValue(canvasElement, label)).toBe('-');
    }

    /* PINS A DEFECT of the same family as the carrier row. `isneutered` is
       collapsed to a boolean BEFORE it reaches the row - `companion?.isneutered
       ? 'Yes' : 'No'` - so a companion whose record has not loaded is reported
       as not neutered rather than unknown. Every other row here manages a dash;
       this one states a clinical fact about an animal nobody has looked up. */
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('No');

    for (const label of PARENT_LABELS) {
      await expect(rowValue(canvasElement, label)).toBe('-');
    }

    /* The appointment knows the parent is called Lena Hartmann - it is on
       `patient.parent.name`, which is how the rest of the modal titles itself -
       and this block still shows eight dashes, because it only ever reads
       `firstName`/`lastName`. The name is available and deliberately unused. */
    await expect(canvas.queryByText('Lena Hartmann')).not.toBeInTheDocument();

    // The accordions themselves survive: empty rows, not a collapsed section.
    await expect(canvas.getByRole('button', { name: 'Companion details' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Parent details' })).toBeInTheDocument();
  },
};

export const PatientTerminology: Story = {
  name: 'Org that says "patient"',
  beforeEach: seed({
    companion: COMPANION_RECORD,
    parent: PARENT_RECORD,
    terminology: 'PATIENT',
    orgType: 'HOSPITAL',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* One title tracks the org's noun and the other does not, and both are
       correct: "Parent details" is the fixed product term for the owner, so it
       must not become "Patient details" on a hospital account. The pair only
       reads right when exactly one of them moves. */
    await expect(canvas.getByRole('button', { name: 'Patient details' })).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Companion details' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Parent details' })).toBeInTheDocument();

    // The rewrite is on the title only - no field label mentions the noun, so
    // the rows are identical to the default story.
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Yes');
  },
};

export const Phone: Story = {
  name: 'Phone: label and value share one row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* Each row is a `justify-between` flex row with no wrap and no truncation,
       so at 375px a long value (the email here is the widest) squeezes the
       label rather than dropping below it. If anyone adds `flex-wrap` to fix
       the squeeze, the value lands under its own label and the two-column read
       the whole tab depends on is gone - and it still looks plausible in a
       screenshot, which is why this is measured rather than eyeballed. */
    for (const label of [...COMPANION_LABELS, ...PARENT_LABELS]) {
      const labelNode = within(canvasElement).getByText(label);
      const valueNode = labelNode.nextElementSibling;
      await expect(valueNode).not.toBeNull();
      const labelBox = labelNode.getBoundingClientRect();
      const valueBox = (valueNode as HTMLElement).getBoundingClientRect();
      await expect(labelBox.right).toBeLessThanOrEqual(valueBox.left + 1);
    }

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
