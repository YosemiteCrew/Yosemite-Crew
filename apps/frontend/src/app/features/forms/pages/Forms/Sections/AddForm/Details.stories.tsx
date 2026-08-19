import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { FormsCategory, FormsProps } from '@/app/features/forms/types/forms';
import Details from './Details';

type ServiceOption = { label: string; value: string; badge?: string; isInpatient?: boolean };

const SERVICE_OPTIONS: ServiceOption[] = [
  { label: 'Dental consultation', value: 'svc-dental', badge: 'Service' },
  { label: 'Senior wellness package', value: 'svc-senior', badge: 'Package' },
  { label: 'Post-op boarding', value: 'svc-boarding', badge: 'Package', isInpatient: true },
];

/**
 * A brand-new custom template: no name, no category, no description, no species,
 * no services, and `requiredSigner` left `undefined` rather than `''`.
 *
 * That last one is the difference between five errors and six. `validate` tests
 * `requiredSigner === undefined`, so an empty string counts as a deliberate
 * "nobody signs this" and passes - which is exactly what `handleCategoryChange`
 * writes when the category becomes SOAP.
 */
const BLANK_CUSTOM: FormsProps = {
  name: '',
  category: '' as FormsCategory,
  usage: 'Internal',
  updatedBy: '',
  lastUpdated: '',
  status: 'Draft',
  schema: [],
  templateSource: 'ORG_TEMPLATE',
  isTemplateBacked: false,
};

const FILLED: FormsProps = {
  ...BLANK_CUSTOM,
  name: 'Anaesthesia consent',
  category: 'Consent form',
  description: 'Signed before any procedure requiring general anaesthetic.',
  requiredSigner: 'CLIENT',
  species: ['Canine'],
  services: ['svc-dental'],
};

/**
 * `Details` is a controlled step - it never holds `formData`, it calls
 * `setFormData` and re-reads - so the harness owns that state the way AddForm
 * does. The error map, by contrast, is genuinely internal: `formDataErrors`
 * starts `{}` and is written only by `validate()`, which is why no prop can put
 * this step into its error state and why the story has to click Next.
 */
const DetailsHarness = ({ initialForm }: { initialForm: FormsProps }) => {
  const [formData, setFormData] = useState<FormsProps>(initialForm);
  return (
    <div className="bg-[var(--screen)] p-4">
      <div className="w-[504px] max-w-full rounded-2xl border border-[var(--hairline)] p-3">
        <Details
          formData={formData}
          setFormData={setFormData}
          onNext={fn()}
          serviceOptions={SERVICE_OPTIONS}
        />
      </div>
    </div>
  );
};

const ALL_ERRORS = [
  'Form name is required',
  'Description is required',
  'Category is required',
  'Signed by is required',
  'Select at least one species',
  'Services / Packages is required for this form category',
];

const meta = {
  title: 'Forms/AddForm Details',
  component: DetailsHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The template Details step, in the state a reviewer never sees: **all six inline errors ' +
          'at once**.\n\n' +
          '`formDataErrors` is local state that starts `{}` and is populated only by `validate()`. ' +
          'Nothing sets it from outside - the parent reaches it through an imperative handle - so ' +
          'there is no prop, no arg and no control that can draw this. Every error variant of ' +
          'every field in this step was therefore undrawn, across two accordions and four ' +
          'different input primitives, each of which renders its error differently: `FormInput` ' +
          'gives a `role="alert"` row wired to the field with `aria-describedby`, while ' +
          '`LabelDropdown` and `MultiSelectDropdown` render an un-roled warning row and tint the ' +
          'trigger border.\n\n' +
          'The six are not independent. `requiredSigner` only errors when it is `undefined` - an ' +
          'empty string is a real answer - and `services` is skipped entirely for the `Custom` ' +
          'category. So a blank **Custom** template produces five errors and a blank ' +
          'org-template produces six, which is why the fixture below is deliberately not Custom.\n\n' +
          'Clearing is per field and happens on the next keystroke rather than on a second ' +
          'submit, so the drawn state is genuinely transient - the last story below spends one ' +
          'keystroke to show that only the touched error goes away.',
      },
    },
  },
  tags: ['autodocs'],
  args: { initialForm: BLANK_CUSTOM },
} satisfies Meta<typeof DetailsHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {
  name: 'Blank step (no errors yet)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing has been validated, so the step is clean even though every
    // required field is empty.
    for (const message of ALL_ERRORS) {
      await expect(canvas.queryByText(message)).not.toBeInTheDocument();
    }
    // Nothing is flagged either, which is a stronger claim than "no message text":
    // `aria-invalid` is written from the same map the messages come from.
    const name = canvas.getByRole('textbox', { name: 'Form name' });
    await expect(name).toHaveValue('');
    await expect(name).toHaveAttribute('aria-invalid', 'false');
    await expect(canvas.getByRole('textbox', { name: 'Description' })).toHaveAttribute(
      'aria-invalid',
      'false'
    );
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    /* Both accordions carry `defaultOpen`, so the step mounts as one tall column
       rather than two collapsed headers. Read off `aria-expanded` rather than off
       the title text: the titles render whether the fold is open or shut, so
       `getByText('Form details')` is true in both states and proves nothing about
       the shape of the step. */
    for (const title of ['Form details', 'Usage and visibility']) {
      await expect(canvas.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }

    /* Every dropdown rests at its own placeholder, which is the resting label a
       reviewer is here to look at - and the reason the error story has to read
       these off `aria-label` instead of by text. */
    const dropdownLabels = [...canvasElement.querySelectorAll('[aria-haspopup="listbox"]')].map(
      (node) => node.getAttribute('aria-label')
    );
    for (const label of ['Category', 'Signed by', 'Species']) {
      await expect(dropdownLabels).toContain(label);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The step as it mounts for a new template. This is the only state that had a shape ' +
          'anyone had looked at.',
      },
    },
  },
};

export const AllErrors: Story = {
  name: 'Six errors at once',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    /* All six, and asserted as a set rather than one by one: `validate` builds
       the whole map in a single pass and commits it once, so a bug that dropped
       one branch would still light up the other five and look correct. */
    for (const message of ALL_ERRORS) {
      expect(await canvas.findByText(message)).toBeInTheDocument();
    }

    /* Only the two `FormInput` fields announce themselves. The dropdown errors
       are plain rows with no role and no `aria-describedby`, which is the real
       accessibility gap this state exposes - four of the six messages are
       invisible to a screen reader. */
    const alerts = canvas.getAllByRole('alert');
    await expect(alerts).toHaveLength(2);
    await expect(alerts.map((node) => node.textContent?.trim())).toEqual([
      'Form name is required',
      'Description is required',
    ]);

    const name = canvas.getByRole('textbox', { name: 'Form name' });
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAttribute('aria-describedby', alerts[0].id);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Press Next on the blank step. The two accordions grow by roughly six rows of message ' +
          'text, which is the layout consequence worth looking at - the step is scrollable inside ' +
          'the builder fold, and this is its tallest state.',
      },
    },
  },
};

export const ErrorsClearPerField: Story = {
  name: 'One keystroke clears one error',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    expect(await canvas.findByText('Form name is required')).toBeInTheDocument();

    await userEvent.type(canvas.getByRole('textbox', { name: 'Form name' }), 'A');

    /* The name error goes and NOTHING else moves. Each handler clears only its
       own key, so a shared reset here would silently hide five real problems
       behind one fixed field. */
    await waitFor(() => {
      expect(canvas.queryByText('Form name is required')).not.toBeInTheDocument();
    });
    for (const message of ALL_ERRORS.slice(1)) {
      await expect(canvas.getByText(message)).toBeInTheDocument();
    }
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Clearing is keyed per field and fires from the change handler, not from a re-validate, ' +
          'so an error can disappear while the value is still invalid (one character is enough ' +
          'here). That is deliberate - re-validating on every keystroke would light the form up ' +
          'while it is being filled in.',
      },
    },
  },
};

export const NoErrorsWhenComplete: Story = {
  name: 'Complete step passes validation',
  args: { initialForm: FILLED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    // The negative control for the story above: same click, no messages, so the
    // six errors are the validator's doing and not the step's resting state.
    for (const message of ALL_ERRORS) {
      await expect(canvas.queryByText(message)).not.toBeInTheDocument();
    }
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(canvas.getByRole('textbox', { name: 'Form name' })).toHaveValue(
      'Anaesthesia consent'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A filled template. Worth keeping beside the error story: without it, a `validate` that ' +
          'returned errors unconditionally would look identical in review.',
      },
    },
  },
};
