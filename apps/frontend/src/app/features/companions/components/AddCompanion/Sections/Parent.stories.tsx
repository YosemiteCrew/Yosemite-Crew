import React, { createRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { toParentResponseDTO } from '@yosemite-crew/types';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import type { StoredParent } from '@/app/features/companions/pages/Companions/types';

import Parent, { type ParentSectionRef } from './Parent';

const buildParent = (overrides: Partial<StoredParent> = {}): StoredParent => ({
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  birthDate: undefined,
  phoneNumber: '',
  address: {
    addressLine: '',
    country: '',
    city: '',
    state: '',
    postalCode: '',
  },
  createdFrom: 'pms',
  ...overrides,
});

/* Local parts, not a UTC literal: the Datepicker formats off local hours, so a
   `...T00:00:00.000Z` fixture renders a day earlier west of Greenwich. */
const BIRTH_DATE = new Date(1989, 10, 2);

const HARTMANN: StoredParent = buildParent({
  id: 'parent-hartmann',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+493090182055',
  birthDate: BIRTH_DATE,
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
});

const HARTMANN_JR: StoredParent = buildParent({
  id: 'parent-hartmann-jr',
  firstName: 'Tobias',
  lastName: 'Hartmann',
  email: 'tobias.hartmann@example.com',
  phoneNumber: '+493090182099',
  address: { ...HARTMANN.address },
});

/* ------------------------------------------------------------------ *
 * Keeping the parent search off the wire
 *
 * `searchParent` is an ESM export, so a story cannot reassign it. It reaches the
 * API through the shared axios instance, which uses the XHR adapter in the
 * browser - so the seam is `XMLHttpRequest.prototype`, the same one ChangeRoom
 * and SoapCodedTermPicker use. Only the parent-search endpoint is answered;
 * anything else is handed to the real transport untouched.
 *
 * Answering matters even for the "no matches" story: a rejected search is logged
 * by `getData` and again by `searchParent`'s own catch, so an unanswered request
 * fails the render check while the component's empty branch behaved correctly.
 * ------------------------------------------------------------------ */

const SEARCH_PATH = '/fhir/v1/parent/pms/search';
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

const withParentSearch =
  (matches: StoredParent[] = []) =>
  () => {
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
      if (!this.storyUrl?.includes(SEARCH_PATH)) {
        REAL_XHR_SEND.call(this, body ?? null);
        return;
      }
      /* Round-tripped through the real serialiser rather than hand-written FHIR,
         so the fixtures cannot drift from what `fromParentRequestDTO` demands.
         Answered on a later tick so the 300ms debounce is exercised rather than
         short-circuited. */
      setTimeout(() => answerWith(this, matches.map(toParentResponseDTO)), 0);
    };

    /* Restored to the module-level originals rather than to whatever was
       installed before, so a meta-level and a story-level stub cannot strand one
       another whichever order their cleanups run in. */
    return () => {
      XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
      XMLHttpRequest.prototype.send = REAL_XHR_SEND;
    };
  };

/**
 * The modal gates the step change on `parentSectionRef.current.validateStep()`,
 * not on the Next button, so that path has no DOM of its own. Holding the ref
 * here lets a play function call it the way the modal does; without it a broken
 * imperative handle only shows up as a tab that silently refuses to advance.
 */
const stepRef = createRef<ParentSectionRef>();

/**
 * `formData` is owned by the AddCompanion modal in the app. The stories hold it
 * here so an edit actually re-renders the field it changed - with a plain spy
 * every keystroke would call the setter and then render the unchanged prop back.
 * The spy is still called, so the stored value (which never reaches the DOM) can
 * be asserted.
 */
const ControlledParent = (args: React.ComponentProps<typeof Parent>) => {
  const [formData, setFormData] = useState(args.formData);
  return (
    <Parent
      {...args}
      ref={stepRef}
      formData={formData}
      setFormData={(value) => {
        setFormData(value);
        args.setFormData(value);
      }}
    />
  );
};

type ParentSetter = React.Dispatch<React.SetStateAction<StoredParent>>;

/**
 * The value the component actually stored, updater forms resolved by replaying
 * them. The joined phone number never reaches the DOM - only the local part is
 * rendered - so the spy is the only place the stored string can be read.
 */
const storedParent = (setFormData: ParentSetter, initial: StoredParent) => {
  const spy = setFormData as unknown as {
    mock?: { calls: [React.SetStateAction<StoredParent>][] };
  };
  let current = initial;
  for (const [value] of spy.mock?.calls ?? []) {
    current = typeof value === 'function' ? value(current) : value;
  }
  return current;
};

const meta = {
  title: 'Companions/AddCompanion/Parent',
  component: Parent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Step 1 of the add-companion modal: the client record. Three things here are invisible ' +
          'from the outside and each has its own story.\n\n' +
          'The **phone number is stored joined** - one `phoneNumber` string - but edited as two ' +
          'controls. On mount `findPhoneData` splits the stored value back into a dial code and a ' +
          'local number, falling back to the address country and then to +1; on every keystroke the ' +
          'local part is stripped to digits, capped at 15, and re-joined to the selected dial code.\n\n' +
          'The **step gate is imperative**. The modal calls `validateStep()` through a ref when the ' +
          'user clicks the second tab, so the same validation runs from two places and only one of ' +
          'them is a button.\n\n' +
          'The **address block is a Google Places field**. It only queries after a focus followed by ' +
          'a keystroke, so every story below leaves it alone and it renders as the plain input it ' +
          'falls back to. Its error is the one field error in this form that is not announced.\n\n' +
          'The parent search is answered from a stub rather than the live API.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: buildParent(),
    setFormData: fn(),
    setActiveLabel: fn(),
  },
  render: (args) => <ControlledParent {...args} />,
  beforeEach: withParentSearch(),
} satisfies Meta<typeof Parent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First and last name share a row. Comparing tops catches a `grid-cols-*`
    // regression that a class assertion would sail past, because Tailwind can
    // emit the class and still resolve it to nothing.
    const first = canvas.getByRole('textbox', { name: "Parent's name" });
    const last = canvas.getByRole('textbox', { name: 'Last name' });
    await expect(first.getBoundingClientRect().top).toBe(last.getBoundingClientRect().top);

    /* The dial code takes 5 of 12 columns and the number 7, so the number is
       ~1.4x the wider of the pair. Swapping them leaves a dial-code box wide
       enough to look deliberate and a number box too narrow to read.
       The two controls do not share an exact top - the dropdown's own caption is
       a fraction shorter than the input's label - so the row is checked by
       overlap and the split by ratio rather than by equality. */
    const dialCode = canvas.getByRole('button', { name: /^Country code: /u });
    const phone = canvas.getByRole('textbox', { name: 'Phone number' });
    const dialCodeBox = dialCode.getBoundingClientRect();
    const phoneBox = phone.getBoundingClientRect();
    await expect(Math.abs(dialCodeBox.top - phoneBox.top)).toBeLessThan(2);
    await expect(phoneBox.width / dialCodeBox.width).toBeGreaterThan(1.25);
    await expect(phoneBox.width / dialCodeBox.width).toBeLessThan(1.55);

    // Nothing stored and no country picked yet, so the fallback dial code stands in.
    await expect(dialCode).toHaveAccessibleName(/^Country code: \+1 United States/u);

    // The only legal-consent copy in the flow hangs off this one icon button.
    const info = canvas.getByRole('button', { name: 'Date of birth information' });
    const bubble = await openGlassTooltip(info);
    await expect(bubble).toHaveTextContent('18 years or older');
  },
};

export const ValidationErrors: Story = {
  name: 'Next with nothing filled in',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The modal's tab gate runs the same check without touching the button.
    await expect(stepRef.current?.validateStep()).toBe(false);

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await waitFor(async () => {
      await expect(canvas.getByText('First name is required')).toBeInTheDocument();
    });
    for (const message of [
      'Last name is required',
      'Email is required',
      'Number is required',
      'Address is required',
      'City is required',
      'State/Province is required',
      'Postal code is required',
    ]) {
      await expect(canvas.getByText(message)).toBeInTheDocument();
    }

    /* Eight fields failed, seven messages are announced. The address field is a
       `GoogleSearchDropDown`, which renders its error as plain text with no
       `role="alert"`, no `aria-invalid` and no `aria-describedby` - so a screen
       reader user is told about every failure except the one that needs a
       lookup. Asserted as it behaves today: a fix has to change this count, and
       the story is where that should be noticed. */
    await expect(canvas.getAllByRole('alert')).toHaveLength(7);
    await expect(canvas.getByRole('textbox', { name: 'Address' })).not.toHaveAttribute(
      'aria-invalid',
      'true'
    );

    // The dial code always resolves to something, so its "required" branch never
    // fires from this form.
    await expect(canvas.queryByText('Country code is required')).toBeNull();
    await expect(args.setActiveLabel).not.toHaveBeenCalled();
  },
};

export const PrefilledParent: Story = {
  name: 'An existing client, ready to advance',
  args: {
    // Trailing whitespace on purpose: the address bar and the clipboard both
    // produce it, and Next is where it is meant to be trimmed away.
    formData: { ...HARTMANN, email: '  lena.hartmann@example.com  ' },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* The record stores one joined string, `+493090182055`. On mount it is split
       back apart: +49 into the dial code, the national number into the field.
       Get this wrong and the number silently doubles its country code the next
       time the form is saved. */
    await expect(canvas.getByRole('button', { name: /^Country code: /u })).toHaveAccessibleName(
      /^Country code: \+49 Germany/u
    );
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('3090182055');

    await expect(stepRef.current?.validateStep()).toBe(true);

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(args.setActiveLabel).toHaveBeenCalledWith('companion');

    // Next also normalises the email on the way out, so the padded value cannot
    // be written to the record.
    await waitFor(async () => {
      await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveValue(
        'lena.hartmann@example.com'
      );
    });
  },
};

export const InvalidContactDetails: Story = {
  name: 'A malformed email and phone number',
  args: { formData: { ...HARTMANN, email: 'lena.hartmann@' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const phone = canvas.getByRole('textbox', { name: 'Phone number' });

    // Digits alone are not enough: +49 1 is well formed and still not a number
    // anyone can ring.
    await userEvent.clear(phone);
    await userEvent.type(phone, '1');
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await waitFor(async () => {
      await expect(canvas.getByText('Enter a valid email')).toBeInTheDocument();
    });
    await expect(canvas.getByText('Enter a valid phone number')).toBeInTheDocument();

    // The "malformed" branch, not the "missing" one - the two are easy to
    // collapse into each other and the distinction is the whole point of the copy.
    await expect(canvas.queryByText('Email is required')).toBeNull();
    await expect(canvas.queryByText('Number is required')).toBeNull();
  },
};

export const PhoneIsStoredJoined: Story = {
  name: 'Dial code and number are stored as one string',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const phone = canvas.getByRole('textbox', { name: 'Phone number' });

    // Spacing and punctuation are stripped rather than stored: the record holds
    // digits only, prefixed with the dial code.
    await userEvent.type(phone, '415 555-0134');
    await expect(phone).toHaveValue('4155550134');
    await expect(storedParent(args.setFormData, buildParent()).phoneNumber).toBe('+14155550134');

    // Changing the country re-joins the number it already has. Left unwired, the
    // visible dial code and the stored one drift apart with nothing on screen
    // that says so.
    await userEvent.click(canvas.getByRole('button', { name: /^Country code: /u }));
    const search = await canvas.findByRole('textbox', { name: 'Search Country code' });
    await userEvent.type(search, 'Germany');

    const menu = await waitFor(() => {
      const found = canvasElement.ownerDocument.body.querySelector<HTMLElement>(
        '[data-portal-dropdown][aria-label="Country code"]'
      );
      if (!found) throw new Error('country code menu did not open');
      return found;
    });
    await userEvent.click(within(menu).getByRole('button', { name: /\+49 Germany/u }));

    await expect(canvas.getByRole('button', { name: /^Country code: /u })).toHaveAccessibleName(
      /^Country code: \+49 Germany/u
    );
    await expect(storedParent(args.setFormData, buildParent()).phoneNumber).toBe('+494155550134');
  },
};

export const SearchResults: Story = {
  name: 'Picking a client from the search',
  beforeEach: withParentSearch([HARTMANN, HARTMANN_JR]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search parent' });

    await userEvent.type(search, 'Har');
    const match = await canvas.findByRole('button', { name: 'Lena Hartmann' }, { timeout: 3000 });
    await userEvent.click(match);

    // Selecting overwrites the whole record, including re-splitting the phone
    // number that arrived joined from the API.
    await waitFor(async () => {
      await expect(canvas.getByRole('textbox', { name: "Parent's name" })).toHaveValue('Lena');
    });
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'lena.hartmann@example.com'
    );
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('3090182055');
    await expect(canvas.getByRole('button', { name: /^Country code: /u })).toHaveAccessibleName(
      /^Country code: \+49 Germany/u
    );
    await expect(canvas.getByRole('textbox', { name: 'City' })).toHaveValue('Berlin');
    // The box keeps the chosen name so it is clear which client is loaded.
    await expect(search).toHaveValue('Lena Hartmann');
  },
};

export const SearchNoResults: Story = {
  name: 'Search with no matches',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search parent' });

    await userEvent.type(search, 'Har');
    // Long enough for the 300ms debounce and the answered request to land.
    await new Promise((resolve) => {
      setTimeout(resolve, 700);
    });

    /* With nothing to offer, the combobox contract has to come apart cleanly: no
       `aria-controls` pointing at a listbox that was never rendered, which is
       announced as an expanded list holding no items. */
    await expect(search).not.toHaveAttribute('aria-controls');
    await expect(canvas.queryByRole('button', { name: 'Lena Hartmann' })).toBeNull();
    // The form underneath is untouched - a failed lookup must not clear it.
    await expect(canvas.getByRole('textbox', { name: "Parent's name" })).toHaveValue('');
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { formData: HARTMANN },
  play: async ({ canvasElement }) => {
    // The name row and the 5/7 phone row are unconditional at this width, so this
    // is the narrowest the form is ever asked to fit. Nothing may push the page
    // sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    const dialCode = within(canvasElement).getByRole('button', { name: /^Country code: /u });
    await expect(dialCode.scrollWidth).toBeLessThanOrEqual(dialCode.clientWidth);
  },
};
