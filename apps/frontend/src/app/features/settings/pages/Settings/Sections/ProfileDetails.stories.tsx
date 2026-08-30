import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { UserProfile } from '@/app/features/users/types/profile';
import api from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import ProfileDetails from './ProfileDetails';

const ORG_ID = 'org-storybook-profile-details';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

/**
 * `roleDisplay` is stored as the role CODE here on purpose. The Role row runs it
 * through `RoleOptions`, so a code that stops matching an option leaks to screen
 * as `VETERINARIAN` - the enum-leak the stories below pin.
 */
const MEMBERSHIP: UserOrganization = {
  id: 'membership-vet',
  practitionerReference: 'Practitioner/practitioner-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'VETERINARIAN',
  active: true,
};

const ATTRIBUTES: Record<string, string> = {
  sub: 'user-1',
  given_name: 'Elena',
  family_name: 'Marsh',
  email: 'elena.marsh@example.com',
};

const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    employmentType: 'FULL_TIME',
    // Local-midnight construction, not a UTC literal: `formatDisplayDate` renders
    // in the reader's preferred zone, and a `Z` string slides a day either way.
    dateOfBirth: '1988-04-12',
    phoneNumber: '+1 415 555 0110',
    address: {
      addressLine: '1180 Sutter Street',
      city: 'San Francisco',
      state: 'California',
      postalCode: '94109',
      country: 'United States',
    },
  },
  professionalDetails: {
    // `linkedin` is deliberately absent: it is the card's one blank field, and a
    // blank must render as a dash rather than an empty cell.
    medicalLicenseNumber: 'CA-VET-44821',
    yearsOfExperience: 11,
    specialization: 'Small animal internal medicine',
    qualification: 'DVM, DACVIM',
    biography: 'Internal medicine lead, with an interest in feline endocrinology.',
  },
};

type CapturedRequest = { method: string; url: string; body: Record<string, unknown> };

/**
 * Every write these cards make goes through the shared axios instance, and the
 * repo has no MSW. `api` is that instance's default export, so swapping its
 * adapter is the one seam that catches all three save handlers without touching
 * the component - and it is what lets a story assert WHICH payload a card sent
 * rather than only that a toast appeared.
 *
 * Module-level because a play function has no other handle on it. Each story
 * clears it in `beforeEach`, so it only aggregates if two stories run against
 * one page - which is the docs page, not `iframe.html`.
 */
const requests: CapturedRequest[] = [];

const putsFor = (path: string) =>
  requests.filter((r) => r.method === 'put' && r.url.includes(path));

const withApi = (outcome: 'accepts' | 'rejects') => () => {
  const originalAdapter = api.defaults.adapter;
  requests.length = 0;

  api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    // axios has already run `transformRequest`, so the body arrives as JSON text.
    const body =
      typeof config.data === 'string'
        ? (JSON.parse(config.data) as Record<string, unknown>)
        : ((config.data as Record<string, unknown>) ?? {});
    requests.push({ method: (config.method ?? 'get').toLowerCase(), url: config.url ?? '', body });

    if (outcome === 'rejects') {
      // 400 rather than 401 or 5xx: a 401 sends the response interceptor into
      // SuperTokens and a real sign-out redirect, and 5xx is on the transient
      // retry list. 400 is the status the profile API actually answers a bad
      // enum with.
      throw Object.assign(new Error('Request failed with status code 400'), {
        isAxiosError: true,
        config,
        response: {
          data: { message: 'Rejected by the story adapter' },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config,
        },
      });
    }

    // Echoing the payload is what the profile API does, and it matters: the
    // service feeds the response straight into the profile store, so the card
    // re-renders from it.
    return { data: body, status: 200, statusText: 'OK', headers: {}, config };
  }) as AxiosAdapter;

  return () => {
    api.defaults.adapter = originalAdapter;
  };
};

/**
 * A rejected write is logged on its way to the toast - `logger.error` in
 * `putData`, then `console.error` in `upsertUserProfile` - and `storyqa-verify`
 * treats any console error as a broken story. Only those two lines are dropped;
 * everything else still reaches the console, so a genuine failure in the story
 * is not hidden behind this.
 */
const EXPECTED_WRITE_FAILURE_LOGS = ['API putData error:', 'Failed to load orgs:'];

const muteExpectedWriteFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' && EXPECTED_WRITE_FAILURE_LOGS.some((line) => arg.includes(line))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

type SeedOptions = {
  attributes?: Record<string, string> | null;
  withMembership?: boolean;
  profile?: UserProfile | null;
};

/**
 * Seeds the real stores rather than mocking the hooks. `ProfileDetails` reads
 * three of them - auth attributes, the org plus its membership, and the user
 * profile - and returns `null` unless the first three are all present, so a
 * story that seeded only some of them would render an empty div and still pass
 * every "the panel exists" assertion.
 */
const seed =
  ({ attributes = ATTRIBUTES, withMembership = true, profile = PROFILE }: SeedOptions = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: withMembership ? { [ORG_ID]: MEMBERSHIP } : {},
      status: 'loaded',
      error: null,
    });
    useUserProfileStore.setState({
      profilesByOrgId: profile ? { [ORG_ID]: profile } : {},
      status: 'loaded',
      error: null,
    });
    useAuthStore.setState({ attributes });

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
        error: null,
      });
      useUserProfileStore.setState({ profilesByOrgId: {}, status: 'idle', error: null });
      useAuthStore.setState({ attributes: null });
    };
  };

/**
 * The right-hand cell of a read-only row. Reading the label's sibling is what
 * makes "Employment type is Full time" an assertion about that row, rather than
 * about the page containing the words somewhere.
 */
const fieldValue = (canvasElement: HTMLElement, label: string): string =>
  within(canvasElement).getByText(label).nextElementSibling?.textContent ?? '';

/** Text of the toasts currently on screen, read off the container. */
const toastText = (): string =>
  [...document.querySelectorAll('.Toastify__toast')].map((n) => n.textContent ?? '').join(' | ');

const meta = {
  title: 'Settings/ProfileDetails',
  component: ProfileDetails,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The three personal-profile cards behind Settings > Edit profile: **User profile**, ' +
          '**Address** and **Professional details**. Each is the same `ProfileCard` given a ' +
          'different field list and, crucially, a **different save handler** - so three cards ' +
          'that look identical write three different payload shapes, and swapping two of them ' +
          'over would change nothing on screen.\n\n' +
          'Two behaviours are worth knowing before reading the stories.\n\n' +
          'It renders **nothing at all** unless auth attributes, the org and the membership are ' +
          'all in the stores. There is no skeleton and no empty state between "loading" and ' +
          '"three cards" - the section is simply absent.\n\n' +
          'And every handler swallows its own failure. `ProfileCard` closes the editor as soon ' +
          'as `onSave` resolves, and these handlers resolve whether the write succeeded, failed ' +
          'or never happened. Worse, the card then reads back from its own form state rather ' +
          'than from the store - so a rejected save and a save against a profile record that ' +
          'does not exist both leave the card **displaying a value the server never took**.\n\n' +
          'The stories seed the real stores and swap the shared axios adapter, so the writes are ' +
          'captured rather than sent.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--page)] p-6">
        <ToastProvider />
        <div className="mx-auto max-w-[760px]">
          <Story />
        </div>
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof ProfileDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The three cards',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Three cards, three round Edit affordances - one per save handler.
    await expect(canvas.getByText('User profile')).toBeInTheDocument();
    await expect(canvas.getByText('Address')).toBeInTheDocument();
    await expect(canvas.getByText('Professional details')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);

    /* The first card is assembled from THREE sources, and each row proves a
       different one is wired: the name and email come from auth attributes, the
       org name from the org store, the role from the membership. */
    await expect(fieldValue(canvasElement, 'First name')).toBe('Elena');
    await expect(fieldValue(canvasElement, 'Email address')).toBe('elena.marsh@example.com');
    await expect(fieldValue(canvasElement, 'Org name')).toBe('Sunrise Veterinary Hospital');

    /* Enum leakage. All three of these are stored SCREAMING_CASE and resolved
       through an options list for display; a value that falls out of its list
       is echoed raw, which is how `FULL_TIME` reaches a customer's screen. */
    await expect(fieldValue(canvasElement, 'Role')).toBe('Veterinarian');
    await expect(fieldValue(canvasElement, 'Employment type')).toBe('Full time');
    await expect(fieldValue(canvasElement, 'Gender')).toBe('Female');

    /* Date of birth is formatted in the reader's preferred time zone, so only the
       year is safe to pin - the day slides by offset and the assertion would
       pass or fail by where the runner sits. */
    await expect(fieldValue(canvasElement, 'Date of birth')).toContain('1988');

    // A field with no stored value is a dash, not an empty cell: the row keeps
    // its height and the reader can tell "nothing here" from "failed to load".
    await expect(fieldValue(canvasElement, 'LinkedIn')).toBe('-');
    await expect(fieldValue(canvasElement, 'Medical license number')).toBe('CA-VET-44821');

    // The separator field carries an empty label and must draw no row at all in
    // read mode, or the card gains a blank line between Employment type and
    // Gender.
    await expect(canvas.queryByText('_sep1')).not.toBeInTheDocument();
    const employmentRow = canvas.getByText('Employment type').parentElement?.parentElement;
    await expect(employmentRow?.nextElementSibling?.textContent).toContain('Gender');
  },
};

export const SavingTheAddress: Story = {
  name: 'Saving the address card',
  beforeEach: withApi('accepts'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Address' }));

    // Only this card entered edit mode - the other two keep their Edit buttons.
    await expect(await canvas.findByRole('textbox', { name: 'City' })).toHaveValue('San Francisco');
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
    // The address line is the `googleAddress` renderer, still a plain textbox
    // seeded from the profile until someone types into it.
    await expect(canvas.getByRole('textbox', { name: 'Address line' })).toHaveValue(
      '1180 Sutter Street'
    );

    await userEvent.clear(canvas.getByRole('textbox', { name: 'City' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'City' }), 'Oakland');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(putsFor('/profile')).toHaveLength(1));
    const body = putsFor('/profile')[0].body as {
      personalDetails: { address: Record<string, string> };
      professionalDetails: Record<string, unknown>;
    };

    /* The point of the story. Three cards share one endpoint and differ only in
       the payload their handler assembles, so this asserts the ADDRESS handler
       ran: the address branch carries the edit, and the professional branch is
       passed through untouched rather than being blanked by a partial payload. */
    await expect(body.personalDetails.address.city).toBe('Oakland');
    await expect(body.personalDetails.address.addressLine).toBe('1180 Sutter Street');
    await expect(body.professionalDetails.qualification).toBe('DVM, DACVIM');

    await waitFor(() => expect(toastText()).toContain('Address details updated'));
    // The card closed and now reads back the value the store took from the reply.
    await waitFor(() => expect(fieldValue(canvasElement, 'City')).toBe('Oakland'));
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edit is per card. The handler rebuilds the whole profile document around the four ' +
          'address fields, which is why the assertion checks that the professional block ' +
          'survived the write - a handler wired to the wrong card looks identical on screen and ' +
          'only shows up in the payload.',
      },
    },
  },
};

export const RejectedSave: Story = {
  name: 'A rejected save still closes the editor',
  beforeEach: [withApi('rejects'), muteExpectedWriteFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Address' }));
    const city = await canvas.findByRole('textbox', { name: 'City' });
    await userEvent.clear(city);
    await userEvent.type(city, 'Oakland');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toastText()).toContain('Unable to update address details'));

    /* The behaviour to look at, and it is worse than "the save was lost". The
       handler catches its own failure and resolves, so `ProfileCard` treats the
       save as done and closes the editor - and because the card renders from its
       own form state rather than from the store, the row now shows "Oakland".
       The server holds San Francisco. Once the toast fades, the card is
       asserting a value that was rejected, and a reload is the only thing that
       corrects it. */
    await waitFor(() =>
      expect(canvas.queryByRole('textbox', { name: 'City' })).not.toBeInTheDocument()
    );
    await expect(fieldValue(canvasElement, 'City')).toBe('Oakland');
    const stored = useUserProfileStore.getState().profilesByOrgId[ORG_ID];
    await expect(stored.personalDetails?.address?.city).toBe('San Francisco');
    await expect(canvas.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The write is rejected with a 400. The toast is the only signal, it is not attached ' +
          'to the card that failed, and the card goes on displaying the rejected value - so ' +
          'once the toast fades the screen and the server disagree with nothing on screen ' +
          'saying so.',
      },
    },
  },
};

export const NoProfileRecord: Story = {
  name: 'No profile record yet',
  beforeEach: [seed({ profile: null }), withApi('accepts')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The identity rows still resolve - they come from auth and the org - but
    // everything the profile document owns is a dash.
    await expect(fieldValue(canvasElement, 'First name')).toBe('Elena');
    await expect(fieldValue(canvasElement, 'Gender')).toBe('-');
    await expect(fieldValue(canvasElement, 'Address line')).toBe('-');
    await expect(fieldValue(canvasElement, 'City')).toBe('-');
    await expect(fieldValue(canvasElement, 'Specialisation')).toBe('-');

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Address' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));

    /* Required-field validation runs before the handler, so an empty address is
       caught in the card rather than sent. All four address fields are required
       and editable, so all four complain at once - but only three are
       ANNOUNCED. `FormInput` gives its message `role="alert"` and wires it to
       the input with `aria-describedby`; the `googleAddress` renderer draws the
       same-looking line as plain text with neither, so a screen reader is told
       about three of the four fields blocking the save. */
    const errors = await canvas.findAllByRole('alert');
    await expect(errors.map((e) => e.textContent)).toEqual([
      'State / Province is required',
      'City is required',
      'Postal code is required',
    ]);
    await expect(canvas.getByText('Address line is required')).toBeInTheDocument();

    await expect(requests).toHaveLength(0);
    await expect(canvas.getByRole('textbox', { name: 'City' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A member whose profile document has not been created yet. The section renders in ' +
          'full - the gate only covers auth, org and membership - so the reader sees three ' +
          'complete cards of dashes.',
      },
    },
  },
};

export const SilentDiscard: Story = {
  name: 'Filling in a profile that does not exist',
  beforeEach: [seed({ profile: null }), withApi('accepts')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Professional details' }));
    await userEvent.type(
      await canvas.findByRole('textbox', { name: 'Specialisation' }),
      'Oncology'
    );
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Qualification (MBBS, MD,etc.)' }),
      'DVM'
    );
    await userEvent.type(canvas.getByRole('spinbutton', { name: 'Years of experience' }), '4');

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* The bug this story exists for. With no profile document the handler hits
       `if (!profile) return;` BEFORE it builds a payload or notifies - so the
       save is a no-op that resolves, and `ProfileCard` closes the editor.
       Nothing was sent and nothing was said, yet the card now displays the typed
       values as though they were stored, because it renders from its own form
       state. The reader has no way to tell this from a successful save until
       they reload and find the dashes back. */
    await waitFor(() =>
      expect(canvas.queryByRole('textbox', { name: 'Specialisation' })).not.toBeInTheDocument()
    );
    await expect(requests).toHaveLength(0);
    await expect(toastText()).toBe('');
    await expect(fieldValue(canvasElement, 'Specialisation')).toBe('Oncology');
    await expect(useUserProfileStore.getState().profilesByOrgId[ORG_ID]).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typed, "saved", never sent. The Address and Professional handlers both bail out ' +
          'early when there is no profile document, and they bail out before the toast - so ' +
          'the only feedback is the editor closing, which is exactly what a successful save ' +
          'does, and the card keeps showing the values it just dropped.',
      },
    },
  },
};

export const Gated: Story = {
  name: 'Nothing renders until the membership loads',
  beforeEach: seed({ withMembership: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Auth and the org are both present; only the membership is missing, which
       is the ordinary state for the first paint after a sign-in. The section
       returns null, so there is no skeleton and no message - the cards are
       simply not there, and a caller that renders a heading above them is left
       with a heading over nothing. */
    await expect(canvas.queryByText('User profile')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Address')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Professional details')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^Edit / })).toHaveLength(0);
  },
};

export const Phone: Story = {
  name: 'Phone: label and value on one line',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* Every row is a no-wrap `justify-between` flex, so this is where a long
       value gets squeezed against its label instead of dropping to a second
       line. The row is allowed to be tight; it is not allowed to push the page
       sideways. Written as relations rather than against a hard 375: the
       viewport global resizes the story frame from the Storybook manager, and
       a headless run that loads `iframe.html` directly gets the panel width. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    const label = within(canvasElement).getByText('Email address');
    const value = label.nextElementSibling as HTMLElement;
    const labelBox = label.getBoundingClientRect();
    const valueBox = value.getBoundingClientRect();
    // Same line, and the value stays inside the viewport rather than clipping.
    await expect(Math.abs(labelBox.top - valueBox.top)).toBeLessThanOrEqual(2);
    await expect(valueBox.right).toBeLessThanOrEqual(globalThis.window.innerWidth);
  },
  parameters: {
    chromatic: { viewports: [375] },
  },
};
