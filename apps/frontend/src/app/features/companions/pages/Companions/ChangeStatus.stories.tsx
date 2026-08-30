import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useOrgStore } from '@/app/stores/orgStore';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import ChangeStatus from './ChangeStatus';

const ORG_ID = 'org-change-status-story';

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
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isneutered: true,
  isInsured: false,
  status: 'active',
  ...overrides,
});

const record = (overrides: Partial<StoredCompanion> = {}): CompanionParent => ({
  companion: companion(overrides),
  parent: PARENT,
});

/**
 * The terminology noun is resolved from the org store AND from localStorage, so a
 * value another story left behind would silently rename this dialog. Both keys are
 * cleared on entry and put back on the way out.
 */
const TERMINOLOGY_KEYS = ['yc_companion_terminology_by_org', 'yc_companion_terminology_pending'];

/**
 * Seed the primary organisation. `useCompanionTerminologyText` reads its type to
 * pick the noun, and `updateCompanion` refuses to write at all without a primary
 * org - which is why the two stories that press Update differ only in this.
 */
const withOrg =
  (primaryOrgId: string | null, type: Organisation['type'] = 'BOARDER') =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const storageSnapshot = TERMINOLOGY_KEYS.map(
      (key) => [key, globalThis.localStorage.getItem(key)] as const
    );
    for (const [key] of storageSnapshot) globalThis.localStorage.removeItem(key);

    const org: Organisation = {
      _id: primaryOrgId ?? ORG_ID,
      name: 'Sunrise Veterinary',
      type,
      phoneNo: '+49 30 555 0134',
      taxId: 'TAX-0001',
    };
    useOrgStore.setState({
      primaryOrgId,
      orgIds: primaryOrgId ? [primaryOrgId] : [],
      orgsById: primaryOrgId ? { [primaryOrgId]: org } : {},
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      for (const [key, value] of storageSnapshot) {
        if (value === null) globalThis.localStorage.removeItem(key);
        else globalThis.localStorage.setItem(key, value);
      }
    };
  };

/**
 * `companionService.updateCompanion` reports its own failures through
 * `console.error` before re-throwing. The verification harness treats a page
 * console error as a broken story, so the deliberate failure below is captured
 * here rather than silenced - the story then asserts that it happened, which is
 * what proves the wrapper reached the real service instead of a no-op.
 */
const serviceErrors: string[] = [];
const captureServiceErrors = () => {
  serviceErrors.length = 0;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    serviceErrors.push(args.map((arg) => String(arg)).join(' '));
  };
  return () => {
    console.error = original;
  };
};

type HarnessProps = {
  activeCompanion: CompanionParent;
  /** Mount the dialog already dismissed, for the closed frame. */
  startOpen?: boolean;
};

/**
 * The consumer's own shape: the companion record owns the flag, the dialog reads
 * it, and dismissing it flips the flag back. Holding it in state here is what
 * lets a story watch the dialog actually close.
 */
const CompanionStatusDialog = ({ activeCompanion, startOpen = true }: HarnessProps) => {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="min-h-[420px] bg-[var(--screen)] p-6">
      <ToastProvider />
      <p className="text-[13px] text-[var(--ink-muted)]">
        The companion record sits behind the dialog, so the scrim tint is visible.
      </p>
      <ChangeStatus showModal={open} setShowModal={setOpen} activeCompanion={activeCompanion} />
    </div>
  );
};

const openDialog = (): HTMLElement | null =>
  globalThis.document.querySelector('dialog[open]') as HTMLElement | null;

const liveDialog = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const dialog = openDialog();
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });

/** The picker trigger, named `"<placeholder>: <selection>"` by `LabelDropdown`. */
const trigger = (dialog: HTMLElement, placeholder: string, selection: string) =>
  within(dialog).getByRole('button', { name: `${placeholder}: ${selection}` });

/**
 * The option panel. `LabelDropdown` portals it to `document.body`, so it is
 * outside both the dialog and the canvas; the LAST one is taken because a panel
 * an earlier story left open is still in the body.
 */
const openPanel = async (dialog: HTMLElement, placeholder: string, selection: string) => {
  await userEvent.click(trigger(dialog, placeholder, selection));
  return waitFor(() => {
    const panels = globalThis.document.querySelectorAll('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1] as HTMLElement;
  });
};

const chooseStatus = async (dialog: HTMLElement, placeholder: string, from: string, to: string) => {
  const panel = await openPanel(dialog, placeholder, from);
  await userEvent.click(within(panel).getByRole('button', { name: to }));
  return waitFor(() => expect(trigger(dialog, placeholder, to)).toBeInTheDocument());
};

/** Toast text read off the container, so duplicates on the docs page cannot throw. */
const toastText = (): string =>
  [...globalThis.document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const meta = {
  title: 'Companions/ChangeStatus',
  component: CompanionStatusDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The companion half of the shared status chooser. It is not a pass-through: it supplies ' +
          'the option list, the transition guard, the refusal message, the placeholder and the ' +
          'write, and every one of those is a decision worth seeing.\n\n' +
          'The **option list is two entries**, Active and Archived. `RecordStatus` has a third ' +
          'value, `inactive`, and the companions directory even has a filter pill for it - but a ' +
          'companion cannot be moved there from this dialog. Nothing on screen says so; the only ' +
          'way to see it is to open the picker.\n\n' +
          'The **guard always returns true**. `canTransitionCompanionStatus` is a constant `true`, ' +
          'so the "Status update blocked" toast and the "Cannot change companion status from X to ' +
          'Y." message the wrapper hands down are unreachable from here. They are wiring for a ' +
          'rule that does not exist yet, and the stories below pin that: pressing Update never ' +
          'produces a toast.\n\n' +
          'The **placeholder is terminology-driven** - `useCompanionTerminologyText` rewrites ' +
          '"Companion status" to the org\'s noun, so a hospital reads "Patient status" on the same ' +
          'dialog.\n\n' +
          'And the **write is `updateCompanion`**, which spreads the whole companion record and ' +
          'overrides only `status`. It cannot be module-mocked in this Storybook, so the two ' +
          'stories that press Update reach the real service and are steered through its own ' +
          'guards instead: a record with no parent link fails inside it, and a session with no ' +
          'primary organisation makes it return without writing at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeCompanion: record(),
  },
  beforeEach: withOrg(ORG_ID),
} satisfies Meta<typeof CompanionStatusDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open on an active companion',
  play: async () => {
    const dialog = await liveDialog();
    const panelOf = within(dialog);

    const heading = panelOf.getByRole('heading', { name: 'Change status' });
    await expect(heading.tagName).toBe('H2');

    /* The picker opens on the status the record already has, not on the
       placeholder, so the reader's first move is always a change away from
       where the companion is. */
    const control = trigger(dialog, 'Companion status', 'Active');
    await expect(control).toHaveAttribute('aria-expanded', 'false');

    const panel = await openPanel(dialog, 'Companion status', 'Active');
    const options = within(panel)
      .getAllByRole('button')
      .map((option) => option.textContent);
    /* Two options, in this order. `RecordStatus` also has `inactive`, and the
       directory filters on it - so a wrapper that passed the whole union through
       would add a third row here that no other screen expects, and nothing would
       fail. */
    await expect(options).toEqual(['Active', 'Archived']);

    await expect(panelOf.getByRole('button', { name: 'Update' })).toBeEnabled();
    await expect(panelOf.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    // The inline failure slot is empty rather than hidden.
    await expect(dialog.querySelectorAll('p')).toHaveLength(0);
  },
};

export const ArchivedCompanion: Story = {
  name: 'Open on an archived companion',
  args: { activeCompanion: record({ name: 'Rufus', status: 'archived' }) },
  play: async () => {
    const dialog = await liveDialog();
    /* Both `currentStatus` and `defaultStatus` come off the record, so an
       archived companion opens on Archived. A wrapper that hard-coded the
       default would show "Active" over an archived record and turn an
       accidental Update into an un-archive. */
    await expect(trigger(dialog, 'Companion status', 'Archived')).toBeInTheDocument();
    await expect(
      within(dialog).queryByRole('button', { name: 'Companion status: Active' })
    ).not.toBeInTheDocument();
  },
};

export const StatusMissingOnTheRecord: Story = {
  name: 'A record with no status falls back to Active',
  args: { activeCompanion: record({ status: undefined }) },
  play: async () => {
    const dialog = await liveDialog();
    /* `activeCompanion.companion.status ?? 'active'`. Companions imported from
       another system arrive without one, and without this the picker would open
       on the placeholder with no selection - and Update would then be comparing
       against `undefined`, so the no-op short-circuit could never fire. */
    await expect(trigger(dialog, 'Companion status', 'Active')).toBeInTheDocument();
  },
};

export const HospitalTerminology: Story = {
  name: 'A hospital reads "Patient status"',
  beforeEach: withOrg(ORG_ID, 'HOSPITAL'),
  play: async () => {
    const dialog = await liveDialog();
    /* The org type picks the noun (HOSPITAL -> patients), and the placeholder is
       run through the rewriter rather than written twice. This is the assertion
       that would fail silently: drop the hook and the dialog still works, it just
       calls the animal a companion inside a hospital that has renamed it. */
    await expect(trigger(dialog, 'Patient status', 'Active')).toBeInTheDocument();
    await expect(dialog.textContent).toContain('Patient status');
    await expect(dialog.textContent).not.toContain('Companion status');
    // The title is fixed product copy and does NOT track the noun.
    await expect(within(dialog).getByRole('heading', { name: 'Change status' })).toBeVisible();
  },
};

export const SaveFails: Story = {
  name: 'The write fails and reports inline',
  args: {
    /* A companion whose parent link never came across in an import. The service
       rejects it before touching the network, which is the one way to reach the
       failure frame here without a module mock. */
    activeCompanion: {
      companion: companion({ parentId: '' }),
      parent: PARENT,
    },
  },
  beforeEach: captureServiceErrors,
  play: async () => {
    const dialog = await liveDialog();
    await chooseStatus(dialog, 'Companion status', 'Active', 'Archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    /* The rejection's own message is shown verbatim, in the inline slot under the
       picker - so a service-layer sentence written for a log reaches the reader
       unchanged. */
    const failure = await within(dialog).findByText('Companion or Parent ID missing');
    await expect(failure.tagName).toBe('P');

    // The dialog stays open on the chosen status, so the press can be repeated.
    await expect(openDialog()).not.toBeNull();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled()
    );
    await expect(trigger(dialog, 'Companion status', 'Archived')).toBeInTheDocument();

    /* The guard is a constant `true`, so no transition is ever refused from this
       wrapper and the toast branch cannot fire. The message the wrapper builds
       for it ("Cannot change companion status from ... to ...") is unreachable. */
    await expect(toastText()).not.toContain('Status update blocked');
    await expect(toastText()).not.toContain('Cannot change companion status');

    // And the failure really came from the service, not from a stub in the story.
    await expect(serviceErrors.join(' ')).toContain('Failed to create service');
  },
};

export const WriteSkippedWithoutAnOrg: Story = {
  name: 'No organisation selected: the dialog closes without writing',
  beforeEach: withOrg(null),
  play: async () => {
    const dialog = await liveDialog();
    await chooseStatus(dialog, 'Companion status', 'Active', 'Archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    /* `updateCompanion` returns early when there is no primary organisation - it
       warns to the console and resolves - so `onSave` looks successful and the
       dialog closes on a change that was never sent. Indistinguishable from a
       saved write at this surface, which is the point of drawing it. */
    await waitFor(() => expect(openDialog()).toBeNull());
    await expect(toastText()).not.toContain('Status update blocked');
  },
};

export const Closed: Story = {
  name: 'Closed',
  args: { startOpen: false },
  play: async () => {
    /* `ChangeStatusModal` always mounts - `showModal` only toggles the dialog's
       open state - so the closed frame has to prove the dialog is INERT rather
       than absent. Without that, its buttons stay in the tab order behind the
       record and the picker can still be reached with a keyboard. */
    const dialog = await waitFor(() => {
      const node = globalThis.document.querySelector('dialog.yc-modal-dialog');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    await expect(openDialog()).toBeNull();
    await expect(dialog).toHaveAttribute('inert');
    await expect(dialog.getAttribute('aria-modal')).toBeNull();
  },
};
