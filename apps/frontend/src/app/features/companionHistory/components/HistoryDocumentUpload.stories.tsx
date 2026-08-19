import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import HistoryDocumentUpload from './HistoryDocumentUpload';

const ORG_ID = 'org-storybook-history';

/**
 * Seeds the org store the way bootstrap does, and restores it on unmount.
 *
 * `PermissionGate` derives the effective permission set from `roleCode` against
 * the role table rather than reading the stored `effectivePermissions` snapshot,
 * so seeding the role is most of the fixture - there is no permission array to
 * keep in sync. OWNER is used here because it is the role a practice owner
 * actually holds; it is not the discriminating part, since every role in the
 * table grants `companions:edit:any` (see `REVOKED` below).
 *
 * It also gives the form its `issuingBusinessName` default: the component reads
 * `orgsById[primaryOrgId].name` and writes it into the draft in an effect, so
 * without a seeded org name that field renders empty and the story would be
 * showing a state no signed-in user ever sees.
 */
const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+49 30 5555 0142',
  taxId: 'DE-TAX-000000',
};

const seedOrg = (membership: UserOrganization | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    membershipsByOrgId: membership ? { [ORG_ID]: membership } : {},
    orgsById: { [ORG_ID]: ORG },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

/**
 * The only honest denied fixture.
 *
 * There is no role that lacks this grant: all seven entries in
 * `ROLE_PERMISSIONS` - down to RECEPTIONIST - carry `companions:edit:any`, so
 * swapping the role code cannot close this gate and a "receptionist" fixture
 * would have rendered the trigger and quietly asserted nothing. The only way a
 * real member loses it is a per-member revocation, which
 * `resolveMembershipPermissions` subtracts from the role baseline.
 */
const REVOKED: UserOrganization = {
  ...OWNER,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  revokedPermissions: ['companions:edit:any'],
};

/** The portalled panel, or a thrown error naming what actually happened. */
const openDialog = (): HTMLElement => {
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) throw new Error('No open dialog is mounted on document.body.');
  return dialog as HTMLElement;
};

const meta = {
  title: 'CompanionHistory/HistoryDocumentUpload',
  component: HistoryDocumentUpload,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Upload record" sheet on the companion history timeline. Only the trigger button ' +
          'has ever been visible in Storybook; everything below it lives behind a local ' +
          '`uploadOpen` boolean on a component the timeline renders in passing, so the panel ' +
          'itself, the whole `CompanionDocumentUploadForm` inside it, and the validation ' +
          'messages `handleSave` writes had never been drawn anywhere.\n\n' +
          'Two things the stories make visible that reading the code does not.\n\n' +
          '`handleSave` writes four validation messages and only two of them are reachable. ' +
          '`emptyCompanionRecord` ships with `category: HEALTH` and ' +
          '`subcategory: SURGERY_PROCEDURE` already set, and the dropdowns can only replace a ' +
          'selection, never clear one, so "Category is required" and "Sub-category is required" ' +
          'cannot be produced through the UI. The reachable pair is title and file.\n\n' +
          '"File is required" renders once, not twice. The form passes ' +
          '`formDataErrors.fileUrl` to `CompanionDoc` as `error` **and** renders its own warning ' +
          'row below it; `CompanionDoc` declares that prop in its type and never reads it, so ' +
          'the duplicate the code implies does not exist on screen.\n\n' +
          'The panel is the shared `Modal` at `centered`/`md`, so it is 680px on laptop and up ' +
          'and re-forms into a grabbered bottom sheet below 768px. It portals to ' +
          '`document.body`, which is why every query here goes through `document`, not the ' +
          'canvas.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: 'companion-poppy-812',
    onUploaded: fn(),
  },
  // Laptop, deliberately: the centered panel re-forms into a bottom sheet below
  // 768px, so the 680px width assertion only means something above that.
  globals: { viewport: { value: 'laptop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedOrg(OWNER),
} satisfies Meta<typeof HistoryDocumentUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trigger: Story = {
  name: 'Closed (trigger only)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `Primary` with href="#" renders a <button>, not a link - the href is a
    // legacy prop the component deliberately treats as "not a link".
    await expect(canvas.getByRole('button', { name: 'Upload record' })).toBeInTheDocument();

    /* A closed ModalBase stays MOUNTED, minus its `open` attribute, so asserting
       "no dialog" would fail here and asserting "no form" would pass even if the
       panel were open but empty. `dialog[open]` is the only query that separates
       the two. */
    await expect(document.querySelector('dialog[open]')).toBeNull();
    const dialog = document.querySelector('dialog');
    await expect(dialog).not.toBeNull();
    await expect(dialog).toHaveAttribute('inert');

    /* One control on the whole surface. The form inside the closed panel is not
       rendered lazily - it is mounted the entire time - so counting the canvas's
       buttons is what proves the sheet's eight controls are behind the portal
       rather than sitting in the timeline. */
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting timeline state: one right-aligned `--cta` pill. The dialog element is ' +
          'already in `document.body` at this point, without its `open` attribute and with ' +
          '`inert` set.',
      },
    },
  },
};

export const SheetOpen: Story = {
  name: 'Upload sheet (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Upload record' }));

    const dialog = await waitFor(openDialog);
    const panel = within(dialog);

    /* The header title, not the trigger: both carry the string "Upload record",
       so only the heading role tells them apart.

       Polled, not read once. The `centered` panel carries `transition-opacity
       duration-300` and flips from `opacity-0` to `opacity-100` in the same
       commit that adds `open`, so `dialog[open]` exists a full 300ms before the
       panel has faded in - and at the first frame the computed opacity is
       exactly `0`, which jest-dom reports as invisible for every descendant.
       `getByRole` ignores opacity, so the heading is FOUND and then called
       hidden. Waiting for the fade keeps the assertion instead of dropping it. */
    const title = panel.getByRole('heading', { level: 2, name: 'Upload record' });
    await waitFor(() => expect(title).toBeVisible());

    // The whole form, field by field. Three dropdowns, two text inputs, the
    // issue-date pair, the uploader and Save - eight controls the reviewer has
    // never been able to see composited together.
    /* Exact accessible names, not `/Category/`: `LabelDropdown` builds them as
       `${placeholder}: ${selected.label}`, so these three strings are the evidence
       that the draft opens with a category and a sub-category ALREADY chosen -
       which is what makes two of the four validation messages unreachable. A
       loose regex would have passed on an empty, unselected trigger. */
    await expect(panel.getByRole('button', { name: 'Category: Health' })).toBeInTheDocument();
    await expect(
      panel.getByRole('button', { name: 'Sub-category: Surgery/ Procedure' })
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Visit type: Hospital' })).toBeInTheDocument();
    await expect(panel.getByLabelText('Title')).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    /* The org name is written into the draft by an effect, not by the initial
       reducer state, so this is the one field that proves the store seed reached
       the form rather than merely being present. */
    await expect(panel.getByLabelText('Issuing business name')).toHaveValue(
      'Avenger Park Veterinary'
    );

    // `hasIssueDate` defaults to true, so the date field is rendered on open -
    // the checkbox is a way to REMOVE a field, which is the reverse of how a
    // "include ..." checkbox usually reads.
    /* A role query, not `getByLabelText('Include issue date')`: the string is on
       the wrapping `<label>` AND on the checkbox inside it, so a label query
       matches two elements and throws before it can assert anything. */
    await expect(panel.getByRole('checkbox', { name: 'Include issue date' })).toBeChecked();

    // The date field is prefilled with today from `emptyCompanionRecord`, so the
    // row opens with a value rather than an empty picker.
    const issueDate = panel.getByLabelText('Issue date') as HTMLInputElement;
    await expect(issueDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    /* getBoundingClientRect, not getComputedStyle().width: the panel is padded
       `px-[26px]`, and the content box would read 628 where the recipe says 680. */
    await expect(dialog.getBoundingClientRect().width).toBe(680);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full sheet at laptop width. Content is capped at ' +
          '`max-h-[calc(100%-1.5rem)]` on the panel and again at `max-h-[80vh]` on the caller’s ' +
          'scroller, so on a short window the Save button scrolls rather than the panel growing.',
      },
    },
  },
};

export const ValidationMessages: Story = {
  name: 'Validation (Save with an empty draft)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Upload record' }));

    const dialog = await waitFor(openDialog);
    const panel = within(dialog);
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));

    // Both reachable messages, with their exact copy.
    const titleError = await panel.findByText('Title is required');
    await expect(titleError).toBeInTheDocument();
    await expect(panel.getByText('File is required')).toBeInTheDocument();

    /* The other two messages `handleSave` can write are unreachable: the draft
       starts with a category and a sub-category selected and the dropdowns cannot
       clear a selection. Asserting their absence is the point of this story - it
       is dead validation, not a missing story. */
    await expect(panel.queryByText('Category is required')).not.toBeInTheDocument();
    await expect(panel.queryByText('Sub-category is required')).not.toBeInTheDocument();

    /* Exactly one node, not two. The form hands `fileUrl` to `CompanionDoc` as
       `error` as well, but that component never renders the prop, so a fix there
       would silently double this message. */
    await expect(panel.getAllByText('File is required')).toHaveLength(1);

    // A failed save must not dismiss the draft.
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The title error is a `role="alert"` row under its input in `--danger`, with the ' +
          'input border swapped to `--danger` as well. The file error is a plain warning row ' +
          'under the uploader with no alert role, so a screen reader announces one of the two ' +
          'and not the other.',
      },
    },
  },
};

export const PermissionDenied: Story = {
  name: 'Without companions:edit:any (revoked)',
  beforeEach: seedOrg(REVOKED),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The gate is passed no `fallback` and no `deniedResource`, so a denied member
       gets literally nothing - not a disabled button, not an explanation. The
       timeline above it renders as though records simply cannot be uploaded. */
    await expect(canvas.queryByRole('button', { name: 'Upload record' })).not.toBeInTheDocument();

    /* Nothing at all, rather than "no trigger": the gate returns `null` above the
       Modal too, so the dialog is not merely closed - it is never mounted, and no
       control of any kind is left in the canvas. */
    await expect(canvasElement.querySelectorAll('button')).toHaveLength(0);
    await expect(document.querySelector('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A receptionist whose `companions:edit:any` has been revoked on the membership - the ' +
          'only shape this state has, since every role grants that permission by default. ' +
          'Worth seeing next to the trigger story: the two differ by one pill, and nothing on ' +
          'the page says why it is missing.',
      },
    },
  },
};
