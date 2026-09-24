import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PocLabResultForm from '@/app/features/companionHistory/components/PocLabResultForm';

// Only Date is faked, so "now" is fixed while every timer stays real.
const NOW = new Date(2026, 8, 24, 9, 15, 30);

beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

const setup = ({
  onCreate = jest.fn().mockResolvedValue(true),
  creating,
}: { onCreate?: jest.Mock; creating?: boolean } = {}) => {
  const onClose = jest.fn();
  render(<PocLabResultForm onCreate={onCreate} onClose={onClose} creating={creating} />);
  return { onCreate, onClose };
};

const save = () => userEvent.click(screen.getByRole('button', { name: 'Save lab result' }));

const pick = async (triggerName: RegExp, option: string) => {
  await userEvent.click(screen.getByRole('button', { name: triggerName }));
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};

const field = (label: string | RegExp) => screen.getByLabelText(label);

// A change event per field, not a keystroke each: the suite runs on loaded CI boxes.
const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(field(label), { target: { value } });

describe('PocLabResultForm', () => {
  it('opens with one blank parameter row and Performed at set to now', () => {
    setup();
    expect(screen.getByRole('form', { name: 'Record a lab result' })).toBeInTheDocument();
    expect(field('Performed at')).toHaveValue('2026-09-24T09:15');
    expect(field('Performed at')).toHaveAttribute('max', '2026-09-24T09:15');
    expect(screen.getByRole('button', { name: 'Test type' })).toHaveTextContent(
      'Select a test type'
    );
    expect(field('Parameter 1 name')).toHaveAttribute('placeholder', 'e.g. HGB');
    expect(field('Parameter 1 reference low')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByRole('button', { name: 'Parameter 1 flag: No flag' })).toBeInTheDocument();
    // A single row cannot be removed.
    expect(screen.queryByRole('button', { name: /Remove parameter/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Follow-up recommended' })).not.toBeChecked();
    expect(screen.getAllByText('Optional')).toHaveLength(4);
  });

  it('shows every required error on an empty save, focuses the first, and sends nothing', async () => {
    const { onCreate } = setup();
    await save();

    expect(screen.getByText('Choose a test type.')).toHaveAttribute('role', 'alert');
    const name = field('Parameter 1 name');
    const value = field('Parameter 1 value');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(name.getAttribute('aria-describedby') ?? '')).toHaveTextContent(
      'Enter a parameter name.'
    );
    expect(document.getElementById(value.getAttribute('aria-describedby') ?? '')).toHaveTextContent(
      'Enter a value.'
    );
    expect(screen.getByRole('button', { name: 'Test type' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Test type' })).toHaveAttribute('aria-describedby');
    expect(onCreate).not.toHaveBeenCalled();
    // Save stays enabled so the next press still explains what is missing.
    expect(screen.getByRole('button', { name: 'Save lab result' })).toBeEnabled();
  });

  it('re-validates as fields change after the first attempt', async () => {
    setup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await save();

    await pick(/Test type/, 'Urinalysis');
    expect(screen.queryByText('Choose a test type.')).not.toBeInTheDocument();

    await userEvent.type(field('Parameter 1 name'), 'SG');
    expect(screen.queryByText('Enter a parameter name.')).not.toBeInTheDocument();
    expect(screen.getByText('Enter a value.')).toBeInTheDocument();
    expect(field('Parameter 1 name')).not.toHaveAttribute('aria-invalid');
  });

  it('refuses a future time and focuses Performed at when it is the first problem', async () => {
    const { onCreate } = setup();
    await pick(/Test type/, 'Complete blood count');
    fireEvent.change(field('Performed at'), { target: { value: '2026-09-25T09:15' } });
    await userEvent.type(field('Parameter 1 name'), 'PLT');
    await userEvent.type(field('Parameter 1 value'), '38');
    await save();

    expect(screen.getByText("Performed at can't be in the future.")).toBeInTheDocument();
    expect(field('Performed at')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Performed at')).toHaveFocus();
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.change(field('Performed at'), { target: { value: '' } });
    expect(screen.getByText('Enter when the test was performed.')).toBeInTheDocument();
  });

  it('checks the reference range and focuses the first bad bound', async () => {
    setup();
    await pick(/Test type/, 'Complete blood count');
    await userEvent.type(field('Parameter 1 name'), 'PLT');
    await userEvent.type(field('Parameter 1 value'), '38');
    await userEvent.type(field('Parameter 1 reference low'), 'low');
    await save();

    expect(screen.getByText('Enter a number.')).toBeInTheDocument();
    expect(field('Parameter 1 reference low')).toHaveFocus();

    await userEvent.clear(field('Parameter 1 reference low'));
    await userEvent.type(field('Parameter 1 reference low'), '500');
    await userEvent.type(field('Parameter 1 reference high'), '200');
    expect(screen.getByText('Must be at least the reference low.')).toBeInTheDocument();
    expect(field('Parameter 1 reference high')).toHaveAttribute('aria-invalid', 'true');
  });

  it('adds a parameter row, focuses it, and removes rows by position', async () => {
    setup();
    await userEvent.type(field('Parameter 1 name'), 'WBC');
    await userEvent.click(screen.getByRole('button', { name: 'Add parameter' }));

    await waitFor(() => expect(field('Parameter 2 name')).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Remove parameter 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove parameter 2' })).toBeInTheDocument();

    await userEvent.type(field('Parameter 2 name'), 'HCT');
    await userEvent.click(screen.getByRole('button', { name: 'Remove parameter 1' }));

    // The remaining row is renumbered and keeps its own value.
    expect(field('Parameter 1 name')).toHaveValue('HCT');
    expect(screen.queryByLabelText('Parameter 2 name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove parameter/ })).not.toBeInTheDocument();
  });

  it('stops Add parameter at the 100-parameter limit and says why', () => {
    setup();
    const add = screen.getByRole('button', { name: 'Add parameter' });
    // Mounted from the start so the limit is announced when it is reached.
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveClass('sr-only');

    for (let count = 1; count < 100; count += 1) fireEvent.click(add);

    expect(field('Parameter 100 name')).toBeInTheDocument();
    expect(add).toBeDisabled();
    expect(status).toHaveTextContent('A lab result can have up to 100 parameters.');
    expect(status).not.toHaveClass('sr-only');

    fireEvent.click(screen.getByRole('button', { name: 'Remove parameter 100' }));
    expect(add).toBeEnabled();
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveClass('sr-only');
  });

  it('submits the entered values and closes once saved', async () => {
    const { onCreate, onClose } = setup();
    await pick(/Test type/, 'Complete blood count');
    fill(/^Sample type/, 'Whole blood (EDTA)');
    fill(/^Analyzer/, 'ProCyte One');
    fill('Parameter 1 name', 'PLT');
    fill('Parameter 1 value', '38');
    fill('Parameter 1 unit', '×10⁹/L');
    fill('Parameter 1 reference low', '200');
    fill('Parameter 1 reference high', '500');
    await pick(/Parameter 1 flag/, 'Critical low');
    await userEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
    fill(/^Interpretation/, 'Marked thrombocytopenia.');
    fill(/^Notes/, 'Recheck on a fresh sample.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Follow-up recommended' }));
    await save();

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toEqual({
      testType: 'CBC',
      performedAt: '2026-09-24T09:15',
      sampleType: 'Whole blood (EDTA)',
      analyzerName: 'ProCyte One',
      rows: [
        {
          id: expect.any(String),
          name: 'PLT',
          value: '38',
          unit: '×10⁹/L',
          low: '200',
          high: '500',
          flag: 'LL',
        },
        // The spare blank row is dropped by the payload builder, not the form.
        { id: expect.any(String), name: '', value: '', unit: '', low: '', high: '', flag: '' },
      ],
      interpretation: 'Marked thrombocytopenia.',
      notes: 'Recheck on a fresh sample.',
      followUp: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('stays open with its values when the save fails', async () => {
    const { onCreate, onClose } = setup({ onCreate: jest.fn().mockResolvedValue(false) });
    await pick(/Test type/, 'Cytology');
    fill('Parameter 1 name', 'Cellularity');
    fill('Parameter 1 value', 'High');
    await save();

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(field('Parameter 1 value')).toHaveValue('High');
  });

  it('closes on Cancel without saving', async () => {
    const { onCreate, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('disables Save and ignores a submit while a save is in flight', () => {
    const { onCreate } = setup({ creating: true });
    expect(screen.getByRole('button', { name: 'Save lab result' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Record a lab result' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves the latest allowed time forward when Performed at is focused', () => {
    setup();
    act(() => {
      jest.setSystemTime(new Date(2026, 8, 24, 10, 2));
    });
    fireEvent.focus(field('Performed at'));
    expect(field('Performed at')).toHaveAttribute('max', '2026-09-24T10:02');
    act(() => {
      jest.setSystemTime(NOW);
    });
  });

  describe('button sizes', () => {
    const original = globalThis.matchMedia;
    afterEach(() => {
      globalThis.matchMedia = original;
    });

    const mockViewport = (width: number) => {
      globalThis.matchMedia = ((query: string) => ({
        matches: width <= Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? 0),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })) as unknown as typeof globalThis.matchMedia;
    };

    it('uses full-width 44px buttons on a phone', () => {
      mockViewport(390);
      setup();
      for (const name of ['Add parameter', 'Cancel', 'Save lab result']) {
        const button = screen.getByRole('button', { name });
        expect(button).toHaveClass('min-h-11', 'w-full');
      }
    });

    it('keeps footer buttons compact on a tablet while parameters stay cards', () => {
      mockViewport(800);
      setup();
      expect(screen.getByRole('button', { name: 'Add parameter' })).toHaveClass('min-h-11');
      expect(screen.getByRole('button', { name: 'Save lab result' })).toHaveClass('min-h-8');
      expect(screen.getByRole('button', { name: 'Save lab result' })).not.toHaveClass('w-full');
    });

    it('keeps every button compact on a desktop', () => {
      mockViewport(1280);
      setup();
      expect(screen.getByRole('button', { name: 'Add parameter' })).toHaveClass('min-h-8');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-8');
    });
  });
});
