import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import PocLabResultForm from './PocLabResultForm';
import { toDateTimeLocal } from './pocLabForm';

/**
 * Options render in a portal on document.body, outside the story canvas. The
 * trigger is scrolled into view first, as a person would: the menu closes on an
 * outer scroll, and focusing an off-screen trigger scrolls the page.
 */
const choose = async (canvasElement: HTMLElement, trigger: RegExp, option: string) => {
  const button = within(canvasElement).getByRole('button', { name: trigger });
  button.scrollIntoView({ block: 'center' });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await userEvent.click(button);
  const listbox = await within(canvasElement.ownerDocument.body).findByRole('listbox');
  await userEvent.click(within(listbox).getByRole('option', { name: option }));
};

const type = (canvasElement: HTMLElement, label: string | RegExp, value: string) =>
  fireEvent.change(within(canvasElement).getByLabelText(label), { target: { value } });

/** The design's filled state: a CBC with three parameters and a spare row in focus. */
const fillCbc = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await choose(canvasElement, /Test type/, 'Complete blood count');
  type(canvasElement, /^Sample type/, 'Whole blood (EDTA)');
  const rows: Array<[string, string, string, string, string, string]> = [
    ['WBC', '18.2', '×10⁹/L', '6', '17', 'High'],
    ['HCT', '0.41', 'L/L', '0.37', '0.55', 'Normal'],
    ['PLT', '38', '×10⁹/L', '200', '500', 'Critical low'],
  ];
  for (const [index, [name, value, unit, low, high, flag]] of rows.entries()) {
    const n = index + 1;
    if (n > 1) await userEvent.click(canvas.getByRole('button', { name: 'Add parameter' }));
    type(canvasElement, `Parameter ${n} name`, name);
    type(canvasElement, `Parameter ${n} value`, value);
    type(canvasElement, `Parameter ${n} unit`, unit);
    type(canvasElement, `Parameter ${n} reference low`, low);
    type(canvasElement, `Parameter ${n} reference high`, high);
    await choose(canvasElement, new RegExp(`Parameter ${n} flag`), flag);
  }
  type(
    canvasElement,
    /^Interpretation/,
    'Marked thrombocytopenia with mild leukocytosis. Recheck platelets on a fresh sample.'
  );
  await userEvent.click(canvas.getByRole('checkbox', { name: 'Follow-up recommended' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Add parameter' }));
  await waitFor(() => expect(canvas.getByLabelText('Parameter 4 name')).toHaveFocus());
};

/** The design's error state: no test type, a future time, a row missing each half. */
const saveWithErrors = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  type(canvasElement, 'Performed at', toDateTimeLocal(tomorrow));
  type(canvasElement, /^Sample type/, 'Whole blood (EDTA)');
  type(canvasElement, 'Parameter 1 name', 'WBC');
  type(canvasElement, 'Parameter 1 value', '18.2');
  await userEvent.click(canvas.getByRole('button', { name: 'Add parameter' }));
  type(canvasElement, 'Parameter 2 name', 'HCT');
  type(canvasElement, 'Parameter 2 unit', 'L/L');
  await userEvent.click(canvas.getByRole('button', { name: 'Add parameter' }));
  type(canvasElement, 'Parameter 3 value', '38');
  type(canvasElement, 'Parameter 3 reference low', '500');
  type(canvasElement, 'Parameter 3 reference high', '200');
  await userEvent.click(canvas.getByRole('button', { name: 'Save lab result' }));
};

const expectDesignErrors = async (canvasElement: HTMLElement, onCreate: unknown) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByText('Choose a test type.')).toBeVisible();
  await expect(canvas.getByText("Performed at can't be in the future.")).toBeVisible();
  await expect(canvas.getByText('Enter a value.')).toBeVisible();
  await expect(canvas.getByText('Enter a parameter name.')).toBeVisible();
  await expect(canvas.getByText('Must be at least the reference low.')).toBeVisible();
  await expect(canvas.getByLabelText('Parameter 3 reference high')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  await expect(canvas.getByRole('button', { name: 'Test type' })).toHaveFocus();
  await expect(canvas.getByRole('button', { name: 'Save lab result' })).toBeEnabled();
  await expect(onCreate).not.toHaveBeenCalled();
};

const meta = {
  title: 'CompanionHistory/PocLabResultForm',
  component: PocLabResultForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inline form in the In-house lab results panel that records one point-of-care result. ' +
          'Test type and Performed at are required, and each parameter needs a name and a value; ' +
          'unit, reference range and flag are optional. Fully blank parameter rows are ignored. ' +
          'Validation runs on Save and again on every change after that, so Save stays enabled ' +
          'and always says what is missing. From 1024px the parameters are a table; below that ' +
          'each one is a card, and below 768px the buttons are full-width 44px targets.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    creating: false,
    onCreate: fn(async () => true),
    onClose: fn(),
  },
} satisfies Meta<typeof PocLabResultForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('form', { name: 'Record a lab result' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Test type' })).toHaveTextContent(
      'Select a test type'
    );
    await expect(canvas.getByLabelText('Performed at')).not.toHaveValue('');
    await expect(canvas.getAllByText('Optional')).toHaveLength(4);
    await expect(canvas.queryByRole('button', { name: /Remove parameter/ })).toBeNull();
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const Filled: Story = {
  name: 'Filled (CBC, spare row in focus)',
  play: async ({ canvasElement, args }) => {
    await fillCbc(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Parameter 3 flag: Critical low' })
    ).toBeVisible();
    await expect(canvas.getByRole('checkbox', { name: 'Follow-up recommended' })).toBeChecked();
    await expect(canvas.getByRole('button', { name: 'Remove parameter 4' })).toBeVisible();
    await expect(args.onCreate).not.toHaveBeenCalled();
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement, args }) => {
    await saveWithErrors(canvasElement);
    await expectDesignErrors(canvasElement, args.onCreate);
  },
};

export const Saving: Story = {
  name: 'Saving (Save disabled)',
  args: { creating: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save lab result' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  },
};

export const Submits: Story = {
  name: 'Submits and closes',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await choose(canvasElement, /Test type/, 'Urinalysis');
    type(canvasElement, 'Parameter 1 name', 'USG');
    type(canvasElement, 'Parameter 1 value', '1.012');
    await userEvent.click(canvas.getByRole('button', { name: 'Save lab result' }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(1));
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        testType: 'URINALYSIS',
        rows: [expect.objectContaining({ name: 'USG', value: '1.012' })],
      })
    );
  },
};

export const ParameterLimit: Story = {
  name: 'Parameter limit reached (100)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const add = canvas.getByRole('button', { name: 'Add parameter' });
    const status = canvas.getByRole('status');
    await expect(status).toBeEmptyDOMElement();
    // One click at a time: each new row has to render before the next click reads the rows.
    for (let count = 1; count < 100; count += 1) await userEvent.click(add);
    await waitFor(() => expect(canvas.getByLabelText('Parameter 100 name')).toHaveFocus());
    await expect(add).toBeDisabled();
    await expect(status).toHaveTextContent('A lab result can have up to 100 parameters.');
    await expect(status).toBeVisible();
    await expect(canvas.queryByLabelText('Parameter 101 name')).toBeNull();
  },
};

// Pinned as a global: Storybook 10 reads the viewport selection from globals only.
const phone = { globals: { viewport: { value: 'mobile', isRotated: false } } } as const;

export const PhoneFilled: Story = {
  ...phone,
  name: 'Phone - filled',
  play: async ({ canvasElement }) => {
    await fillCbc(canvasElement);
    const save = within(canvasElement).getByRole('button', { name: 'Save lab result' });
    await expect(save.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

export const PhoneValidationErrors: Story = {
  ...phone,
  name: 'Phone - validation errors',
  play: async ({ canvasElement, args }) => {
    await saveWithErrors(canvasElement);
    await expectDesignErrors(canvasElement, args.onCreate);
  },
};
