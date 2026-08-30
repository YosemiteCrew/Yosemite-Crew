import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { toCompanionResponseDTO, type Organisation } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { formatDisplayDate } from '@/app/lib/date';
import type {
  BreedCodeEntry,
  SpeciesCodeEntry,
} from '@/app/features/companions/services/codeEntriesService';
import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import Companion from './Companion';

const ORG_ID = 'org-companion-record-story';

/* Local date parts, never a `...Z` literal. The read-only row formats the date of
   birth through `Intl` in the runner's timezone, so a UTC string slides a day
   west of Greenwich and the expected label - built from the same formatter
   below - would agree or disagree by machine. */
const DOB = new Date(2021, 3, 18);

const PARENT: StoredParent = {
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
};

const companion = (overrides: Partial<StoredCompanion> = {}): StoredCompanion => ({
  id: 'companion-1',
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  speciesCode: 'YC-SPC-001',
  breedCode: 'YC-BRD-001',
  dateOfBirth: DOB,
  gender: 'female',
  currentWeight: 12.4,
  colour: 'Tricolour',
  bloodGroup: 'DEA 1.1 Negative',
  isneutered: false,
  microchipNumber: '276098106834298',
  passportNumber: 'DE-4471-88',
  isInsured: false,
  countryOfOrigin: 'Germany',
  source: 'breeder',
  ...overrides,
});

const record = (overrides: Partial<StoredCompanion> = {}): CompanionParent => ({
  companion: companion(overrides),
  parent: PARENT,
});

const SPECIES_ENTRIES: SpeciesCodeEntry[] = [
  { code: 'YC-SPC-001', display: 'Canine' },
  { code: 'YC-SPC-002', display: 'Feline' },
  { code: 'YC-SPC-003', display: 'Equine' },
];

/* 'Beagle' twice on purpose: the mapper de-duplicates on `entry.display`, and a
   vocabulary carrying one breed under two codes is the normal case. Without the
   `seen` set the menu renders it twice and React warns on the duplicate key. */
const BREED_ENTRIES: BreedCodeEntry[] = [
  { code: 'YC-BRD-001', display: 'Beagle', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-002', display: 'Border Collie', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-003', display: 'Beagle', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-004', display: 'Whippet', meta: { speciesCode: 'YC-SPC-001' } },
];

/* ------------------------------------------------------------------ *
 * Keeping the section off the wire
 *
 * `fetchSpeciesCodeEntries`, `fetchBreedCodeEntries` and `updateCompanion` are
 * ESM exports, so a story cannot reassign them. All three reach the API through
 * the shared axios instance, which uses the XHR adapter in the browser - so the
 * seam is `XMLHttpRequest.prototype`, the same one the AddCompanion section and
 * ChangeRoom use.
 *
 * Answering is not optional. `getData`/`putData` log a failed request through
 * `logger.error` and every service re-logs its own catch, so an unanswered call
 * surfaces as a console error and fails the render check even when the
 * component's own fallback branch behaved correctly.
 * ------------------------------------------------------------------ */

type ApiReply = {
  species?: SpeciesCodeEntry[];
  breeds?: BreedCodeEntry[];
  /** What the PUT echoes back; defaults to the record it was handed. */
  saved?: StoredCompanion;
};

const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

type StubbedXhr = XMLHttpRequest & { storyUrl?: string };

const answerWith = (xhr: XMLHttpRequest, body: unknown) => {
  const text = JSON.stringify(body);
  // Own data properties shadow the prototype's accessors, which is the only way
  // to hand axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
  Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: text, configurable: true });
  // axios settles the promise from `onloadend`.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const stubTransport = (reply: ApiReply) => {
  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: StubbedXhr,
    method: string,
    url: string | URL,
    isAsync?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.storyUrl = String(url);
    REAL_XHR_OPEN.call(this, method, url, isAsync ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function stubbedSend(
    this: StubbedXhr,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this.storyUrl ?? '';
    // Species and breed share one endpoint and are told apart only by the `type`
    // query parameter axios appended.
    if (url.includes('/v1/codes/entries')) {
      const payload = url.includes('type=BREED')
        ? (reply.breeds ?? BREED_ENTRIES)
        : (reply.species ?? SPECIES_ENTRIES);
      setTimeout(() => answerWith(this, payload), 0);
      return;
    }
    if (url.includes('/fhir/v1/companion/org/')) {
      /* Round-tripped through the real serialiser rather than hand-written FHIR,
         so the fixture cannot drift from what `fromCompanionRequestDTO` demands
         when `updateCompanion` parses the reply back. */
      setTimeout(() => answerWith(this, toCompanionResponseDTO(reply.saved ?? companion())), 0);
      return;
    }
    REAL_XHR_SEND.call(this, body ?? null);
  };

  /* Restored to the module-level originals rather than to whatever was installed
     before, so a meta-level and a story-level stub cannot strand one another
     whichever order their cleanups run in. */
  return () => {
    XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

/**
 * The accordion title and the status placeholder are run through
 * `useCompanionTerminologyText`, which resolves the noun from `primaryOrgId` and
 * `orgsById[id].type` AND from localStorage. A value another story left behind
 * would silently rename this pane, so both keys are cleared on entry and put
 * back on the way out. `updateCompanion` also refuses to write without a primary
 * org, which is why the status-save story needs one seeded.
 */
const TERMINOLOGY_KEYS = ['yc_companion_terminology_by_org', 'yc_companion_terminology_pending'];

const prepare =
  (options: { orgType?: Organisation['type']; reply?: ApiReply } = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const companionSnapshot = useCompanionStore.getState();
    const storageSnapshot = TERMINOLOGY_KEYS.map(
      (key) => [key, globalThis.localStorage.getItem(key)] as const
    );
    for (const [key] of storageSnapshot) globalThis.localStorage.removeItem(key);

    const restoreTransport = stubTransport(options.reply ?? {});

    const org: Organisation = {
      _id: ORG_ID,
      name: 'Larkspur Boarding',
      type: options.orgType ?? 'BOARDER',
      phoneNo: '+49 30 555 0134',
      taxId: 'TAX-2291',
    };
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: org },
    });

    return () => {
      restoreTransport();
      useOrgStore.setState(orgSnapshot);
      useCompanionStore.setState(companionSnapshot);
      for (const [key, value] of storageSnapshot) {
        if (value === null) globalThis.localStorage.removeItem(key);
        else globalThis.localStorage.setItem(key, value);
      }
    };
  };

/**
 * The value beside a label. `CompanionRow` is a two-child flex, so the value is
 * the row's last element - reading it by position rather than by text is what
 * lets a story assert a dash without matching one of the fifteen other rows.
 */
const rowValue = (canvasElement: HTMLElement, label: string): string => {
  const labelNode = within(canvasElement).getByText(label);
  const row = labelNode.parentElement as HTMLElement;
  return (row.lastElementChild as HTMLElement).textContent ?? '';
};

/** `LabelDropdown` portals its menu to <body>, so it is outside `canvasElement`. */
const openMenu = async (canvasElement: HTMLElement, triggerName: string) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: triggerName }));
  return waitFor(() => {
    const panels = canvasElement.ownerDocument.body.querySelectorAll('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    // The LAST one: a panel an earlier story left open is still in the body.
    return panels[panels.length - 1] as HTMLElement;
  });
};

const meta = {
  title: 'Companions/Sections/Companion',
  component: Companion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The companion record inside the companion drawer: a read-only summary, a full edit form ' +
          'behind a reducer, and a separate Status accordion.\n\n' +
          '**Insurance is derived, not read.** `isInsured` is ' +
          '`isInsured || insurance.companyName || insurance.policyNumber`, so a record whose flag ' +
          'says "not insured" still shows Insured (and the two policy rows) if either insurance ' +
          'field survived. That branch has its own story.\n\n' +
          '**The neutered wording comes from gender.** A female reads Spayed / Not spayed and her ' +
          'extra row is "Age when spayed"; everyone else reads Neutered. The row itself only ' +
          'exists when `isneutered` is set.\n\n' +
          '**Species and breed are vocabulary-backed.** Entering edit mode fetches the species ' +
          'code list and then the breed list for that species, so Breed is empty until the ' +
          'vocabulary answers - and stays empty when it answers with nothing. Save resolves the ' +
          'codes again before it writes, but only when species or breed actually changed.\n\n' +
          '**The two accordions are gated differently.** The record editor is always offered - ' +
          '`showEditIcon` is a literal `true` - while the Status editor appears only when the ' +
          'caller passes `canEditCompanionStatus`, which is the only prop the pane takes besides ' +
          'the record.\n\n' +
          'The stories answer the vocabulary and companion endpoints from an XHR stub, so nothing ' +
          'here reaches the network. Rendered at 530px, the width of the drawer that opens it.',
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
  beforeEach: prepare(),
} satisfies Meta<typeof Companion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  name: 'Read-only: not insured, not spayed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both accordions open on mount - the drawer scrolls to this pane already
    // expanded, so a collapsed default would read as an empty record.
    await expect(canvas.getByRole('button', { name: 'Companion information' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Status' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    /* Species is resolved through the option table, so the reader sees "Canine"
       and never the stored `dog`. Gender is NOT - it is printed raw. Asserting
       both together is what keeps that asymmetry visible; title-casing one and
       not the other is exactly the kind of thing that gets "fixed" in one place. */
    await expect(rowValue(canvasElement, 'Species')).toBe('Canine');
    await expect(canvas.queryByText('dog')).not.toBeInTheDocument();
    await expect(rowValue(canvasElement, 'Gender')).toBe('female');

    await expect(rowValue(canvasElement, 'Breed')).toBe('Beagle');
    // Built from the component's own formatter so the expectation cannot drift
    // from the runner's timezone or locale.
    await expect(rowValue(canvasElement, 'Date of birth')).toBe(formatDisplayDate(DOB, '-'));

    /* Not neutered: the wording is the female form, and the age row is absent
       rather than dashed. A row that appeared with a dash would read as "we
       don't know", which is a different claim from "she has not been spayed". */
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Not spayed');
    await expect(canvas.queryByText('Age when spayed')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Age when neutered')).not.toBeInTheDocument();

    // Not insured: the status row stands alone, the two policy rows do not exist.
    await expect(rowValue(canvasElement, 'Insurance status')).toBe('Not insured');
    await expect(canvas.queryByText('Insurance company')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Insurance policy number')).not.toBeInTheDocument();

    /* No `status` on the record falls back to 'active'. Without it the row would
       render the empty string and the status editor would open on nothing. */
    await expect(rowValue(canvasElement, 'Current status')).toBe('Active');

    /* The record editor is always offered; the status editor is not, because
       `canEditCompanionStatus` defaults to false. Two accordions, two different
       gates - and only one pencil on screen proves it. */
    await expect(canvas.getByRole('button', { name: 'Edit Companion information' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
  },
};

export const InsuredWithoutTheFlag: Story = {
  name: 'Insured because a policy survived, not because the flag says so',
  args: {
    companion: record({
      isInsured: false,
      insurance: { isInsured: false, companyName: 'Agila', policyNumber: 'AG-99184' },
    }),
  },
  play: async ({ canvasElement }) => {
    /* `isInsured` is derived from three sources OR'd together, so a record whose
       boolean says false is still shown as insured when either policy field has
       content. This is the branch that decides whether two rows exist at all,
       and the record it fires on is the one an import or a half-finished edit
       leaves behind. */
    await expect(rowValue(canvasElement, 'Insurance status')).toBe('Insured');
    await expect(rowValue(canvasElement, 'Insurance company')).toBe('Agila');
    await expect(rowValue(canvasElement, 'Insurance policy number')).toBe('AG-99184');
  },
};

export const SpayedFemale: Story = {
  name: 'Spayed: the age row appears and takes the female wording',
  args: { companion: record({ isneutered: true, ageWhenNeutered: '2' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* One flag drives two strings and one row. `gender === 'female'` picks
       Spayed over Neutered in both the status value and the extra row's label,
       so a record can never read "Spayed" above "Age when neutered". */
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Spayed');
    await expect(rowValue(canvasElement, 'Age when spayed')).toBe('2');
    await expect(canvas.queryByText('Age when neutered')).not.toBeInTheDocument();
  },
};

export const NeuteredMaleWithoutAnAge: Story = {
  name: 'Neutered male with the age unrecorded',
  args: { companion: record({ gender: 'male', isneutered: true, ageWhenNeutered: '' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(rowValue(canvasElement, 'Neutered status')).toBe('Neutered');
    /* The row is keyed off `isneutered`, not off the age, so it still appears
       and dashes. That is the honest reading: he is neutered, the age is
       unknown - which is a different record from an entire missing row. */
    await expect(rowValue(canvasElement, 'Age when neutered')).toBe('-');
    await expect(canvas.queryByText('Age when spayed')).not.toBeInTheDocument();
  },
};

export const Archived: Story = {
  name: 'An archived record',
  args: { companion: record({ status: 'archived' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The status is stored lower-case and title-cased for display, so the raw
       enum never reaches the reader. The record editor stays available on an
       archived companion - archiving is not a lock. */
    await expect(rowValue(canvasElement, 'Current status')).toBe('Archived');
    await expect(canvas.queryByText('archived')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Edit Companion information' })).toBeVisible();
  },
};

export const Editing: Story = {
  name: 'Edit mode, pristine',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion information' }));

    // The read-only rows are replaced, not hidden alongside the form.
    await expect(canvas.queryByText('Insurance status')).not.toBeInTheDocument();

    /* Breed is empty until the vocabulary answers, so the trigger starts on the
       bare placeholder and only picks up the record's breed once the fetch has
       resolved and re-synced the dropdown. Waiting on the *named* trigger is
       what proves the async re-sync happened at all. */
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Breed: Beagle' })).toBeInTheDocument()
    );
    await expect(canvas.getByRole('button', { name: 'Species: Canine' })).toBeInTheDocument();

    // The de-duplicated menu: four entries in, three out, Beagle once.
    const menu = await openMenu(canvasElement, 'Breed: Beagle');
    const options = within(menu)
      .getAllByRole('button')
      .map((option) => option.textContent);
    await expect(options).toEqual(['Beagle', 'Border Collie', 'Whippet']);
    await userEvent.keyboard('{Escape}');

    /* The neutered flag is false, so the age field is not mounted - the same
       conditional the read-only view uses, which is what keeps the two halves
       agreeing about whether the record has an age at all. */
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Age when spayed (optional)' })
    ).not.toBeInTheDocument();
    // Not insured, so the two policy inputs are absent for the same reason.
    await expect(canvas.queryByRole('textbox', { name: 'Company name' })).not.toBeInTheDocument();

    // The weight arrives as a number and is stringified into a text-ish input.
    await expect(
      canvas.getByRole('spinbutton', { name: 'Current weight (optional) (kg)' })
    ).toHaveValue(12.4);

    /* Cancel restores the read view from `companion.companion` rather than from
       the draft, and hands the pencil back - the section hides its own pencil
       while editing, so without this the only way out would be a save. */
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(rowValue(canvasElement, 'Breed')).toBe('Beagle');
    await expect(canvas.getByRole('button', { name: 'Edit Companion information' })).toBeVisible();
  },
};

export const SaveBlockedByValidation: Story = {
  name: 'Save blocked: species, breed, date of birth and both insurance fields',
  args: {
    /* A record imported without a species, breed or date of birth, flagged
       insured with nothing filled in. Every one of the five validation branches
       fires at once, which is also the only way to see them in one frame. */
    companion: record({
      type: '' as never,
      breed: '',
      dateOfBirth: undefined as never,
      currentWeight: undefined,
      isInsured: true,
      insurance: { isInsured: true, companyName: '', policyNumber: '' },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion information' }));

    /* `currentWeight` is interpolated as `formData.currentWeight + ''`, so a
       record with no weight puts the literal string "undefined" in the field -
       and saving it writes NaN through `toNonNegativeNumber`, which returns
       undefined again. It reads as a real value to anyone editing the record.
       Asserted rather than described so the day it is fixed, this fails. */
    await expect(
      canvas.getByRole('spinbutton', { name: 'Current weight (optional) (kg)' })
    ).toHaveValue(null);
    await expect(
      canvas.getByRole('spinbutton', { name: 'Current weight (optional) (kg)' })
    ).toHaveAttribute('value', 'undefined');

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    // All five, together. Validation runs before the code resolution and before
    // the write, so nothing left the browser.
    await expect(await canvas.findByText('Species is required')).toBeVisible();
    await expect(canvas.getByText('Breed is required')).toBeVisible();
    await expect(canvas.getByText('Date of birth is required')).toBeVisible();
    await expect(canvas.getByText('Company name is required')).toBeVisible();
    await expect(canvas.getByText('Policy number is required')).toBeVisible();

    /* The form stays open on the failed save - the errors are attached to the
       controls that caused them, so closing here would throw the draft away
       along with the explanation. */
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(canvas.queryByText('Insurance status')).not.toBeInTheDocument();
  },
};

export const BreedVocabularyEmpty: Story = {
  name: 'The breed vocabulary answers with nothing',
  beforeEach: prepare({ reply: { breeds: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion information' }));

    /* With no breed options the dropdown cannot resolve the record's own breed,
       so the trigger falls back to the bare placeholder - the stored "Beagle"
       is simply not shown. Saving from here would clear the breed, so the empty
       vocabulary is a data-loss path, not only a cosmetic one. */
    const trigger = await canvas.findByRole('button', { name: 'Breed' });
    await expect(canvas.queryByRole('button', { name: 'Breed: Beagle' })).not.toBeInTheDocument();

    // Species is a static three-entry table, so it is unaffected by the failure.
    await expect(canvas.getByRole('button', { name: 'Species: Canine' })).toBeInTheDocument();

    await userEvent.click(trigger);
    const menu = await waitFor(() => {
      const panels = canvasElement.ownerDocument.body.querySelectorAll('[data-portal-dropdown]');
      expect(panels.length).toBeGreaterThan(0);
      return panels[panels.length - 1] as HTMLElement;
    });
    await expect(within(menu).getByText('No options')).toBeVisible();
  },
};

export const StatusEditor: Story = {
  name: 'Status editor: cancel reverts, save closes',
  args: { companion: record(), canEditCompanionStatus: true },
  beforeEach: prepare({ reply: { saved: companion({ status: 'archived' }) } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Status' }));
    /* Only two options, Active and Archived. `RecordStatus` has a third value,
       `inactive`, and the companions directory even filters on it - but a
       companion cannot be moved there from this pane. Nothing on screen says
       so; opening the menu is the only way to see it. */
    const menu = await openMenu(canvasElement, 'Companion status: Active');
    const options = within(menu)
      .getAllByRole('button')
      .map((option) => option.textContent);
    await expect(options).toEqual(['Active', 'Archived']);

    await userEvent.click(within(menu).getByRole('button', { name: 'Archived' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Companion status: Archived' })).toBeInTheDocument()
    );

    /* Cancel resets `statusValue` from the record, not from the draft. Without
       that reset the pane closes showing Archived over a companion the API
       still has as active - a lie the reader has no way to detect. */
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(rowValue(canvasElement, 'Current status')).toBe('Active');

    // Round two, this time through the write. The PUT is answered by the stub.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Status' }));
    const reopened = await openMenu(canvasElement, 'Companion status: Active');
    await userEvent.click(within(reopened).getByRole('button', { name: 'Archived' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* A successful write closes the editor and leaves the new status on the
       row. The editor closing is the only signal the save landed - there is no
       toast and no inline confirmation here. */
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Companion status: Archived' })
      ).not.toBeInTheDocument()
    );
    await expect(rowValue(canvasElement, 'Current status')).toBe('Archived');
    await expect(canvas.getByRole('button', { name: 'Edit Status' })).toBeVisible();

    // The write really went through the service: the companion store now holds
    // the archived record, which is what the directory list renders from.
    await expect(useCompanionStore.getState().companionsById['companion-1']?.status).toBe(
      'archived'
    );
  },
};

export const HospitalTerminology: Story = {
  name: 'A hospital reads "Patient information"',
  args: { companion: record(), canEditCompanionStatus: true },
  beforeEach: prepare({ orgType: 'HOSPITAL' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The org type picks the noun and the title is run through the rewriter
       rather than written twice. This is the assertion that fails silently:
       drop the hook and the pane still works, it just calls the animal a
       companion inside a hospital that has renamed it. */
    await expect(canvas.getByRole('button', { name: 'Patient information' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Edit Patient information' })).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Companion information' })
    ).not.toBeInTheDocument();

    // "Status" is fixed product copy and does NOT track the noun - only the
    // dropdown placeholder inside the editor does.
    await expect(canvas.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Status' }));
    await expect(
      canvas.getByRole('button', { name: 'Patient status: Active' })
    ).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the species/breed row stays two columns',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion information' }));
    const species = await canvas.findByRole('button', { name: 'Species: Canine' });
    /* The exact name, not a `/^Breed/` regex: the origin pills include a
       "Breeder" button, so the loose match finds two. */
    const breed = await canvas.findByRole('button', { name: 'Breed: Beagle' });

    /* `grid-cols-2` carries no responsive prefix, so the pair never stacks: at
       375px each dropdown keeps half the drawer. Measuring the two boxes is the
       assertion - they must share a row (equal tops) and be equally wide, which
       is what a stray `md:` or a min-width would break. */
    const speciesBox = species.getBoundingClientRect();
    const breedBox = breed.getBoundingClientRect();
    await expect(Math.round(speciesBox.top)).toBe(Math.round(breedBox.top));
    await expect(Math.abs(speciesBox.width - breedBox.width)).toBeLessThanOrEqual(1);
    await expect(breedBox.left).toBeGreaterThan(speciesBox.right);

    // And nothing in the form pushes the page sideways at phone width.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
