import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Speciality } from '@yosemite-crew/types';

import type { BillingCounter, BillingSubscription } from '@/app/features/billing/types/billing';
import { useCounterStore } from '@/app/stores/counterStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { PHONE_MEDIA_QUERY } from '@/app/ui/layout/PhoneShell/useIsPhone';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import AddTeam from './AddTeam';

const ORG_ID = 'org-storybook-add-team';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const SPECIALITIES: Speciality[] = [
  { _id: 'spec-cardiology', organisationId: ORG_ID, name: 'Cardiology', isActive: true },
  { _id: 'spec-dentistry', organisationId: ORG_ID, name: 'Dentistry', isActive: true },
];

/**
 * `useCanMoreForPrimaryOrg('users')` needs BOTH halves before it will say yes:
 * a subscription (otherwise `no_subscription`) and a counter (otherwise
 * `no_counter`). On the free plan it then compares `freeUsersLimit` against
 * `usersBillableCount`, so the difference between these two counters is the
 * whole difference between an invite that sends and one that is refused.
 */
const FREE_PLAN: BillingSubscription = {
  orgId: ORG_ID,
  plan: 'free',
  accessState: 'free',
  subscriptionStatus: 'none',
};

const SEATS_LEFT: BillingCounter = { orgId: ORG_ID, freeUsersLimit: 10, usersBillableCount: 4 };
const SEATS_FULL: BillingCounter = { orgId: ORG_ID, freeUsersLimit: 10, usersBillableCount: 10 };

type BillingSeed = {
  subscription?: BillingSubscription | null;
  counter?: BillingCounter | null;
};

/**
 * Seeds the four real stores rather than mocking the hooks. Every hook the
 * drawer calls on mount is a pure selector - `useSpecialitiesForPrimaryOrg`
 * reads the speciality store, `useCanMoreForPrimaryOrg` reads the subscription
 * and counter stores, and `useSubscriptionCounterUpdate` only hands back a
 * `refetch` - so the panel mounts with real options and fires no request at all
 * until Send invite is pressed.
 */
const seed =
  ({ subscription = FREE_PLAN, counter = SEATS_LEFT }: BillingSeed = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      status: 'loaded',
    });
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);
    useSubscriptionStore.getState().setSubscriptionForOrg(ORG_ID, subscription);
    useCounterStore.getState().setCounterForOrg(ORG_ID, counter);

    return () => {
      useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, status: 'idle' });
      useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
      useSubscriptionStore.setState({ subscriptionByOrgId: {} });
      useCounterStore.setState({ countersByOrgId: {} });
    };
  };

/**
 * Offline transport for the one story that actually sends.
 *
 * `sendInvite` POSTs through the shared axios instance and the counter refetch
 * behind it GETs twice more. Axios picks the XHR adapter in the browser, so
 * replacing `XMLHttpRequest` is the only seam that does not mean mocking a
 * module - and this Storybook has no request-mocking layer. Everything answers
 * `200 {}`, which the finance normalisers accept unchanged, so the success path
 * runs end to end without a backend and without a console error.
 */
class OfflineXhr {
  status = 200;
  statusText = 'OK';
  responseText = '{}';
  response = '{}';
  responseURL = '';
  readyState = 4;
  timeout = 0;
  withCredentials = false;
  responseType = '';
  onloadend: (() => void) | null = null;
  open = () => undefined;
  setRequestHeader = () => undefined;
  getAllResponseHeaders = () => 'content-type: application/json\r\n';
  abort = () => undefined;
  send = () => {
    setTimeout(() => this.onloadend?.(), 0);
  };
}

const withOfflineApi = () => {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = OfflineXhr as unknown as typeof XMLHttpRequest;
  return () => {
    globalThis.XMLHttpRequest = original;
  };
};

/**
 * Forces the phone branch of `Modal` by answering the one media query
 * `useIsPhone` asks about, imported from the hook so the two cannot drift.
 *
 * The viewport global below it is what a reader (and Chromatic) sees, but it
 * only resizes the preview iframe from the Storybook manager: opened directly,
 * `iframe.html` keeps the real window size and `matchMedia` keeps answering
 * "no". So the play function pins the BRANCH - which shell the panel takes -
 * and deliberately measures no geometry, because Sheet.css's own
 * `max-width: 767px` block is still evaluated against the real window and the
 * numbers would be meaningless.
 */
const withPhoneMediaQuery = () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    if (query !== PHONE_MEDIA_QUERY) return original.call(globalThis, query);
    return {
      matches: true,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

/**
 * The drawer portals to `document.body`, so none of it is inside
 * `canvasElement`, and `ModalBase` leaves a dismissed dialog MOUNTED and only
 * drops the `open` attribute. Absence therefore has to be asserted against
 * `dialog[open]` - querying for the element itself finds it either way and
 * would pass whatever happened.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
const drawer = () => openDialogs()[0];

/** Both dropdown panels portal out of the drawer's scrolling column too. */
const dropdownPanels = () =>
  Array.from(document.querySelectorAll('[data-portal-dropdown]')) as HTMLElement[];

const openDropdownPanel = async () =>
  waitFor(() => {
    const panels = dropdownPanels();
    expect(panels).toHaveLength(1);
    return panels[0];
  });

/**
 * The multi-select does NOT close after a pick, and its portalled panel is
 * positioned over the field below it. Clicking the modal title closes it
 * without side effects: the dropdown's outside-mousedown fires, the modal's
 * does not, because the target is inside the dialog.
 */
const dismissDropdown = async (dialogEl: HTMLElement) => {
  await userEvent.click(within(dialogEl).getByRole('heading', { name: 'Add team' }));
  await waitFor(() => expect(dropdownPanels()).toHaveLength(0));
};

const pickSpeciality = async (dialogEl: HTMLElement, label: string) => {
  await userEvent.click(within(dialogEl).getByRole('button', { name: 'Speciality' }));
  await userEvent.click(within(await openDropdownPanel()).getByRole('button', { name: label }));
  await dismissDropdown(dialogEl);
};

const pickRole = async (dialogEl: HTMLElement, label: string) => {
  await userEvent.click(within(dialogEl).getByRole('button', { name: 'Role' }));
  await userEvent.click(within(await openDropdownPanel()).getByRole('button', { name: label }));
  // A single-select closes itself on pick, unlike the speciality panel above.
  await waitFor(() => expect(dropdownPanels()).toHaveLength(0));
};

/** Everything the four validation branches need to be satisfied at once. */
const fillValidInvite = async (dialogEl: HTMLElement) => {
  await userEvent.type(
    within(dialogEl).getByLabelText('Email'),
    'lena.hartmann@sunrisevet.example'
  );
  await pickSpeciality(dialogEl, 'Cardiology');
  await pickRole(dialogEl, 'Veterinarian');
};

const AddTeamHarness = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The team list sits behind the drawer, so the backdrop tint is visible.
      </p>
      <AddTeam showModal={open} setShowModal={setOpen} />
      {/* `notify` calls react-toastify directly. With no container mounted the
          success toast is queued and never painted, so a sent invite would look
          identical to one that silently failed. */}
      <ToastProvider />
    </div>
  );
};

const meta = {
  title: 'Organization/AddTeam',
  component: AddTeamHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The **Add team** invite drawer, opened from the Team section. It is a 470px (`md`) ' +
          'right-side panel holding one accordion of four fields, and it had never been drawn - ' +
          'so none of the four ways it can refuse to send were reviewable outside the live app ' +
          'against a seeded organisation.\n\n' +
          '**Validation collects all four branches in one pass.** `handleSave` builds an errors ' +
          'object before it does anything else: the billing check, then email, then speciality, ' +
          'then role. Nothing short-circuits, so an empty form on a maxed-out plan reports four ' +
          'problems at once - and the three field errors are reported by three different ' +
          'components with three different accessibility contracts. Only `FormInput` emits a ' +
          '`role="alert"` line wired to the input through `aria-describedby`; the two dropdowns ' +
          'render a red message with no alert semantics at all, so assistive tech is told about ' +
          'the email and not about the other two.\n\n' +
          '**The billing banner renders outside the accordion**, between the scrolling column ' +
          'and the footer, which is the reason it cannot be scrolled out of view while the ' +
          'button that produced it is on screen. It has two wordings and they mean different ' +
          'things: `limit_reached` is a real refusal the practice can act on by upgrading, while ' +
          'every other falsy reason - no subscription record, no counter, an unparseable limit - ' +
          'collapses into one "we couldn\'t verify" line that tells the reader nothing about ' +
          'which of the four it was.\n\n' +
          '**Owner cannot be invited.** The role list is `RoleOptions.slice(1)`, so the first ' +
          'entry is dropped and only six of the seven roles are offered. Nothing in the UI says ' +
          'so, which is why the story below counts the options rather than describing them.\n\n' +
          'The employee-type row is a `SelectLabel`: three plain buttons whose selected state is ' +
          'carried entirely by colour. There is no `aria-pressed`, no radio group and no ' +
          'fieldset, so a screen reader hears three identical unlabelled choices and no answer. ' +
          'That gap is asserted rather than described, so wiring it up fails the story.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed(),
} satisfies Meta<typeof AddTeamHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'The invite drawer as it opens',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    /* 470px, the `md` drawer width. Measured off the border box rather than read
       off the class list, because the width lives in a `sm:` utility that a
       narrower canvas would silently drop. */
    await expect(Math.round(dialogEl.getBoundingClientRect().width)).toBe(470);

    /* The dialog carries NO accessible name. `Modal` applies whichever of
       aria-label / aria-labelledby it is handed and this caller hands it
       neither, so a screen reader announces "dialog" while the sighted reader
       has "Add team" in 17px bold at the top. Asserted, not described, so that
       wiring the header up (a `titleId` and one prop) fails this line. */
    await expect(dialogEl).not.toHaveAttribute('aria-label');
    await expect(dialogEl).not.toHaveAttribute('aria-labelledby');
    await expect(dialogEl).toHaveAttribute('aria-modal', 'true');

    /* "Add team" appears TWICE inside one 470px panel - once as the modal title
       and once as the title of the only accordion in it. Counted rather than
       found, because `getByText` would happily pass with either one missing. */
    await expect(panel.getAllByText('Add team')).toHaveLength(2);
    await expect(panel.getByRole('heading', { name: 'Add team', level: 2 })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Add team' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    // Empty form: nothing typed, neither dropdown answered, no errors raised yet.
    await expect(panel.getByLabelText('Email')).toHaveValue('');
    await expect(panel.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
    await expect(panel.getByRole('button', { name: 'Speciality' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(panel.getByRole('button', { name: 'Role' })).toBeInTheDocument();
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);

    /* Employee type is answered from the first render - `initialData.type` is
       `EmploymentTypes[0].value` - but ONLY in colour. The three buttons carry
       no aria-pressed, no radio role and no group, so the one fact the form
       already knows is the one fact assistive tech cannot read. */
    await expect(panel.getByRole('button', { name: 'Full time' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Part time' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Contract' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Full time' })).not.toHaveAttribute(
      'aria-pressed'
    );
    await expect(panel.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    await expect(panel.queryAllByRole('radio')).toHaveLength(0);

    // The plan has seats left, so no billing banner above the single action.
    await expect(panel.queryByText(/free user limit/i)).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state: four fields, one of them already answered, and one action. The ' +
          'panel is a form drawer with no Cancel - the only way out other than sending is the ' +
          'header X, the backdrop or Escape, none of which asks about unsaved input.',
      },
    },
  },
};

export const OptionsComeFromTheOrg: Story = {
  name: "Speciality options are the org's, and Owner is not invitable",
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    await userEvent.click(panel.getByRole('button', { name: 'Speciality' }));
    /* The listbox portals to document.body, so it sits outside the drawer's own
       `overflow-y-auto` column - which is why it is not clipped by it, and also
       why it cannot be reached through `within(drawer())`. */
    const specialityPanel = within(await openDropdownPanel());
    // Both seeded specialities and only those: the list is this organisation's,
    // so an empty speciality store renders an empty panel rather than a default.
    await expect(specialityPanel.getAllByRole('button')).toHaveLength(2);
    await expect(specialityPanel.getByRole('button', { name: 'Cardiology' })).toBeInTheDocument();
    await expect(specialityPanel.getByRole('button', { name: 'Dentistry' })).toBeInTheDocument();
    // Multi-select, so each option announces its own state - the one dropdown in
    // this drawer that does have an ARIA contract.
    await expect(specialityPanel.getByRole('button', { name: 'Cardiology' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await userEvent.click(specialityPanel.getByRole('button', { name: 'Cardiology' }));
    await expect(specialityPanel.getByRole('button', { name: 'Cardiology' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await dismissDropdown(dialogEl);
    // The pick reached formData: the trigger renames itself from the bare
    // placeholder to "placeholder: selection".
    await expect(panel.getByRole('button', { name: 'Speciality: Cardiology' })).toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'Role' }));
    const rolePanel = within(await openDropdownPanel());
    /* SIX roles, not seven. The drawer passes `RoleOptions.slice(1)`, which
       drops Owner - an organisation cannot invite a second owner - and nothing
       on screen says so. Counted, because losing the slice would add a seventh
       row that looks entirely reasonable. */
    await expect(rolePanel.getAllByRole('button')).toHaveLength(6);
    await expect(rolePanel.queryByRole('button', { name: 'Owner' })).not.toBeInTheDocument();
    await expect(rolePanel.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    await expect(rolePanel.getByRole('button', { name: 'Receptionist' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both pickers portal out of the drawer, which is what stops the scrolling column from ' +
          'clipping them. The speciality list is data - it grows with the practice - while the ' +
          'role list is a shipped constant with its first entry removed at the call site.',
      },
    },
  },
};

export const RequiredFieldErrors: Story = {
  name: 'Send invite pressed on an empty form',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    await userEvent.click(panel.getByRole('button', { name: 'Send invite' }));

    /* All three at once. `handleSave` collects into one errors object with no
       early return, so the reader is never walked through the form one refusal
       at a time. */
    expect(await panel.findByText('Email is required')).toBeInTheDocument();
    await expect(panel.getByText('Speciality is required')).toBeInTheDocument();
    await expect(panel.getByText('Role is required')).toBeInTheDocument();

    /* Three messages, ONE alert. Only `FormInput` announces itself and wires the
       message to the field; the two dropdowns paint a red border and a red line
       with no role and no `aria-describedby`, so two thirds of this response is
       invisible to a screen reader. */
    await expect(panel.queryAllByRole('alert')).toHaveLength(1);
    await expect(panel.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(panel.getByLabelText('Email')).toHaveAccessibleDescription('Email is required');

    // The plan has seats, so the billing branch stays quiet while the other
    // three fire - the four checks are independent.
    await expect(panel.queryByText(/free user limit/i)).not.toBeInTheDocument();
    await expect(panel.queryByText(/verify your users limit/i)).not.toBeInTheDocument();

    // Validation runs before the request, so nothing was sent and the drawer
    // stays open on the input the reader still has to fix.
    await expect(openDialogs()).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The rejection every new user meets first. Worth looking at the distance between the ' +
          'pressed button and the three messages: the footer is pinned and the fields scroll, so ' +
          'on a short window a reader can press Send invite and see nothing move.',
      },
    },
  },
};

export const InvalidEmail: Story = {
  name: 'A malformed email with everything else answered',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    await userEvent.type(panel.getByLabelText('Email'), 'lena.hartmann@');
    await pickSpeciality(dialogEl, 'Dentistry');
    await pickRole(dialogEl, 'Technician');

    await userEvent.click(panel.getByRole('button', { name: 'Send invite' }));

    /* One message, and it is the "invalid" wording rather than the "required"
       one - `getEmailValidationError` distinguishes an empty field from a
       malformed address, and only this story reaches the second branch. */
    expect(await panel.findByText('Enter a valid email')).toBeInTheDocument();
    await expect(panel.queryByText('Email is required')).not.toBeInTheDocument();

    /* Both dropdown errors are absent, which is the real assertion here: the
       picks were made through PORTALLED panels that are not children of the
       component, so this is the only proof that either handler reached
       `formData` at all. */
    await expect(panel.queryByText('Speciality is required')).not.toBeInTheDocument();
    await expect(panel.queryByText('Role is required')).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Speciality: Dentistry' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Role: Technician' })).toBeInTheDocument();
    await expect(panel.queryAllByRole('alert')).toHaveLength(1);

    /* Typing again clears the email error on the keystroke, before any
       re-validation - the field's own onChange wipes it, so the message cannot
       outlive the value that caused it. */
    await userEvent.type(panel.getByLabelText('Email'), 'sunrisevet.example');
    await waitFor(() => expect(panel.queryAllByRole('alert')).toHaveLength(0));
    await expect(panel.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The address is checked with `validator`\'s `isEmail` after a trim, so "lena.hartmann@" ' +
          'is rejected for having no domain. The error clears on the next keystroke rather than ' +
          'on the next press, which is why the field can look clean while the form is still ' +
          'invalid.',
      },
    },
  },
};

export const FreeUserLimitReached: Story = {
  name: 'Free user limit reached',
  beforeEach: seed({ counter: SEATS_FULL }),
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    // Nothing announces the ceiling until the invite is attempted: the drawer
    // opens looking exactly like one that would succeed.
    await expect(panel.queryByText(/free user limit/i)).not.toBeInTheDocument();

    await fillValidInvite(dialogEl);
    await userEvent.click(panel.getByRole('button', { name: 'Send invite' }));

    const banner = await panel.findByText(
      'You’ve reached your free user limit. Please upgrade to book more.'
    );

    /* A completely valid invite, refused on billing alone - which is the point
       of seeding a full counter over a filled form rather than an empty one. */
    await expect(panel.queryByText('Email is required')).not.toBeInTheDocument();
    await expect(panel.queryByText('Enter a valid email')).not.toBeInTheDocument();
    await expect(panel.queryByText('Speciality is required')).not.toBeInTheDocument();
    await expect(panel.queryByText('Role is required')).not.toBeInTheDocument();
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);

    /* The banner lives OUTSIDE the scrolling column, between it and the footer.
       That placement is the whole reason it cannot be scrolled away from the
       button that produced it, and moving it inside the accordion - the obvious
       place for a field error - would look fine in a screenshot and break the
       guarantee. Asserted structurally AND by order. */
    const scrollColumn = panel.getByLabelText('Email').closest('.overflow-y-auto') as HTMLElement;
    await expect(scrollColumn).not.toBeNull();
    await expect(scrollColumn.contains(banner)).toBe(false);
    const sendButton = panel.getByRole('button', { name: 'Send invite' });
    await expect(banner.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      scrollColumn.getBoundingClientRect().bottom
    );
    await expect(banner.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      sendButton.getBoundingClientRect().top
    );

    // Refused before the POST, so the drawer stays open with the invite intact.
    await expect(openDialogs()).toHaveLength(1);
    await expect(panel.getByRole('button', { name: 'Speciality: Cardiology' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The free plan is capped at `freeUsersLimit` billable users and this organisation has ' +
          'spent all ten. The banner is the only place the cap is ever mentioned - there is no ' +
          'seats-remaining count anywhere in the drawer - and it offers no route to the upgrade ' +
          'it asks for. Note the copy says "to book more", borrowed from the appointments limit ' +
          'that shares this hook.',
      },
    },
  },
};

export const SubscriptionUnknown: Story = {
  name: 'The users limit could not be verified',
  beforeEach: seed({ subscription: null }),
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    await fillValidInvite(dialogEl);
    await userEvent.click(panel.getByRole('button', { name: 'Send invite' }));

    /* The catch-all wording. `useCanMoreForPrimaryOrg` distinguishes four
       non-`limit_reached` refusals - no subscription, no counter, unknown limit,
       unknown usage - and the drawer folds all four into this one line, so the
       reader is told to retry something that a retry cannot fix. */
    expect(
      await panel.findByText('We couldn’t verify your users limit right now. Please try again.')
    ).toBeInTheDocument();
    await expect(
      panel.queryByText('You’ve reached your free user limit. Please upgrade to book more.')
    ).not.toBeInTheDocument();

    // Same shape as the limit banner and the same refusal: no field errors, no
    // request, drawer still open.
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);
    await expect(openDialogs()).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practice sees when the billing record has not loaded - a fresh organisation ' +
          'before its first `checkStatus`, or one whose finance call failed. Inviting is blocked ' +
          'either way, which means a transient billing outage stops a clinic hiring.',
      },
    },
  },
};

export const InviteSent: Story = {
  name: 'A successful invite',
  beforeEach: withOfflineApi,
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    await fillValidInvite(dialogEl);
    await userEvent.click(panel.getByRole('button', { name: 'Send invite' }));

    // The success toast is the only confirmation the invite landed - the drawer
    // closes at the same moment, so the toast is all that is left on screen.
    expect(await within(document.body).findByText('Invite sent')).toBeInTheDocument();
    await expect(
      within(document.body).getByText('Invite has been sent successfully.')
    ).toBeInTheDocument();

    /* The dialog stays MOUNTED and only loses `open`, so this has to be counted
       against `dialog[open]`; querying for the panel itself finds it either way. */
    await waitFor(() => expect(openDialogs()).toHaveLength(0));

    /* `setFormData(initialData)` runs after the close, and the reset has to
       reach the controlled children too. The role dropdown is the one that can
       silently keep its answer: `LabelDropdown` holds the selected option in its
       OWN state and only re-syncs through a render-time guard comparing the
       incoming default, so a reset that fails there leaves the next invite
       pre-filled with the last person's role.

       Read off the attributes rather than through `getByRole`: a dismissed
       dialog is `display: none` and `inert`, so everything in it has left the
       accessibility tree. `hidden: true` would not rescue the query either -
       accname returns the EMPTY STRING for a hidden element, so the name never
       matches. */
    await expect(within(dialogEl).getByLabelText('Email')).toHaveValue('');
    await expect(dialogEl.querySelector('[aria-label="Speciality"]')).not.toBeNull();
    await expect(dialogEl.querySelector('[aria-label^="Speciality: "]')).toBeNull();
    await expect(dialogEl.querySelector('[aria-label="Role"]')).not.toBeNull();
    await expect(dialogEl.querySelector('[aria-label^="Role: "]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole send path with the API answering `200 {}`: POST the invite, refresh the ' +
          'subscription counter, toast, close, reset. The refresh is awaited before the toast, ' +
          'so on a slow network the drawer sits open with no in-flight indication of any kind - ' +
          'the button does not disable, relabel or spin, and a second press sends a second ' +
          'invite.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375): the drawer goes full-screen',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: a story using it still renders, still plays and still passes -
  // at 1280px, under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withPhoneMediaQuery,
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const dialogEl = drawer();
    const panel = within(dialogEl);

    /* `useIsPhone` is false during SSR and the first client render, so the swap
       happens after mount and has to be polled rather than read once. */
    await waitFor(() => expect(dialogEl.className).toContain('yc-modal-fullscreen'));

    /* Full-screen, NOT a bottom sheet. `Modal` branches on `variant` inside the
       phone branch - `centered` re-forms into a sheet wrapped in `SheetChrome`,
       `drawer` (what this caller uses, by omission) goes full-screen with no
       chrome. Both leave a dialog on a phone-sized screen, so the difference is
       only visible in the class and in the absence of the grabber; changing the
       Modal default would swap this panel's whole phone treatment silently. */
    await expect(dialogEl.className).not.toContain('yc-phone-sheet');
    await expect(dialogEl.querySelector('.yc-phone-sheet-grabber')).toBeNull();

    /* Nothing else is re-formed: the phone branch swaps the shell only, so the
       header, the accordion and the single footer action are the same tree. The
       whole panel is now the screen, and the header X is the only way out. */
    await expect(panel.getByRole('heading', { name: 'Add team', level: 2 })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Add team' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(panel.getByLabelText('Email')).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Send invite' })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375px the drawer stops being a panel over the team list and takes the whole screen, ' +
          'so there is no visible way back to what it covered except the header X. The four ' +
          'fields keep their full-width stack and the lone action keeps its `stretch` footer.',
      },
    },
  },
};
