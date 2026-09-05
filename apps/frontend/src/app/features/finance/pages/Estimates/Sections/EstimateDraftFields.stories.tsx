import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import {
  emptyLine,
  toNumber,
  type DraftLine,
} from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import { computeEstimateTotals } from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import {
  EstimateHeaderFields,
  EstimateLineEditor,
  EstimateNotesField,
  EstimateTotalsPanel,
  type CompanionChoice,
} from './EstimateDraftFields';

const COMPANIONS: CompanionChoice[] = [
  { id: 'pat-marnie', name: 'Marnie Whitlock' },
  { id: 'pat-rufus', name: 'Rufus Delacroix' },
  { id: 'pat-pepper', name: 'Pepper Osei' },
];

/**
 * Figures are deliberately not round: 3 x 19.99 has to read as 59.97, and 20%
 * of that as 11.99, or the editor is rounding where the backend does not.
 */
const DENTAL_LINES: DraftLine[] = [
  {
    key: 'line-1',
    description: 'Dental scale and polish',
    quantity: '1',
    unitPrice: '120',
    taxRate: '0',
  },
  {
    key: 'line-2',
    description: 'Pre-anaesthetic bloods',
    quantity: '3',
    unitPrice: '19.99',
    taxRate: '20',
  },
];

type EditorProps = {
  companions: CompanionChoice[];
  currency: string;
  initialPatientId?: string;
  initialValidUntil?: string;
  initialNotes?: string;
  initialLines?: DraftLine[];
};

/**
 * The four exports are slices of one editor and share one draft, so they are
 * composed here the way `CreateEstimateDialog` composes them: header, lines,
 * notes, totals, over local state. The totals are `computeEstimateTotals` on
 * the live lines, which is the arithmetic the dialog ships.
 */
const EstimateEditorFields = ({
  companions,
  currency,
  initialPatientId = '',
  initialValidUntil = '',
  initialNotes = '',
  initialLines,
}: EditorProps) => {
  const [patientId, setPatientId] = useState(initialPatientId);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const [notes, setNotes] = useState(initialNotes);
  const [lines, setLines] = useState<DraftLine[]>(initialLines ?? [emptyLine('line-1')]);
  const nextKey = useRef((initialLines ?? []).length + 1);

  const totals = useMemo(
    () =>
      computeEstimateTotals(
        lines.map((line) => ({
          description: line.description,
          quantity: toNumber(line.quantity),
          unitPrice: toNumber(line.unitPrice),
          taxRate: toNumber(line.taxRate),
        }))
      ),
    [lines]
  );

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-5">
      <EstimateHeaderFields
        companions={companions}
        patientId={patientId}
        setPatientId={setPatientId}
        validUntil={validUntil}
        setValidUntil={setValidUntil}
      />
      <EstimateLineEditor
        lines={lines}
        currency={currency}
        updateLine={(key, patch) =>
          setLines((current) =>
            current.map((line) => (line.key === key ? { ...line, ...patch } : line))
          )
        }
        removeLine={(key) => setLines((current) => current.filter((line) => line.key !== key))}
        addLine={() => {
          nextKey.current += 1;
          setLines((current) => [...current, emptyLine(`line-${nextKey.current}`)]);
        }}
      />
      <EstimateNotesField notes={notes} setNotes={setNotes} />
      <EstimateTotalsPanel totals={totals} currency={currency} />
    </div>
  );
};

/** The value opposite a totals label: the rows are label/value pairs with no other hook. */
const totalsValue = (canvasElement: HTMLElement, label: string) =>
  within(canvasElement).getByText(label).nextElementSibling?.textContent ?? '';

const meta = {
  title: 'Finance/EstimateDraftFields',
  component: EstimateEditorFields,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The four building blocks of the estimate editor: the companion picker and expiry ' +
          'date (`EstimateHeaderFields`), the editable line items with their desktop column ' +
          'headers (`EstimateLineEditor`), the free-text notes (`EstimateNotesField`) and the ' +
          'running subtotal / tax / total (`EstimateTotalsPanel`).\n\n' +
          'They are composed here over one draft the way `CreateEstimateDialog` composes ' +
          'them, because none of the four is meaningful alone: the totals panel only says ' +
          'something once lines exist, and the line editor only proves its Remove gate with ' +
          'more than one line. The arithmetic is `computeEstimateTotals`, which mirrors the ' +
          "backend's `computeTotals` - a line total excludes tax, tax is applied per line, and " +
          'the estimate total is the sum - so the figure the client approves is the figure ' +
          'that is saved.\n\n' +
          'The expiry date carries a `min` of today but nothing derives EXPIRED from it: a ' +
          'lapsed quote stays sendable, which is why the label says "optional".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companions: COMPANIONS,
    currency: 'GBP',
    initialPatientId: 'pat-marnie',
    initialLines: DENTAL_LINES,
    initialNotes: 'Two-stage dental under general anaesthetic.',
  },
} satisfies Meta<typeof EstimateEditorFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'A two-line dental estimate',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Companion')).toHaveValue('pat-marnie');
    await expect(canvas.getByLabelText('Valid until (optional)')).toHaveValue('');
    await expect(canvas.getByLabelText('Notes (optional)')).toHaveValue(
      'Two-stage dental under general anaesthetic.'
    );

    // Both lines, with their pre-tax totals kept to the penny.
    await expect(canvas.getByLabelText('Line 1 description')).toHaveValue(
      'Dental scale and polish'
    );
    await expect(canvas.getByLabelText('Line 2 quantity')).toHaveValue(3);
    await expect(canvas.getByText('£120.00')).toBeInTheDocument();
    await expect(canvas.getByText('£59.97')).toBeInTheDocument();

    // 120 + 59.97 = 179.97; tax is 20% of 59.97 only; total is the sum.
    await expect(totalsValue(canvasElement, 'Subtotal')).toBe('£179.97');
    await expect(totalsValue(canvasElement, 'Tax')).toBe('£11.99');
    await expect(totalsValue(canvasElement, 'Total')).toBe('£191.96');

    // Two lines, so both Remove controls are live.
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Remove line 2' })).toBeEnabled();
  },
};

export const FreshDraft: Story = {
  name: 'A fresh draft',
  args: { initialPatientId: '', initialLines: undefined, initialNotes: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Companion')).toHaveValue('');
    // One empty line, so its Remove control is disabled - a draft cannot have zero lines.
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
    await expect(canvas.getByLabelText('Line 1 quantity')).toHaveValue(1);
    // Line total plus the three totals rows all read zero.
    await expect(canvas.getAllByText('£0.00')).toHaveLength(4);
  },
};

export const AddAndRemoveLines: Story = {
  name: 'Adding a line unlocks Remove',
  args: { initialPatientId: '', initialLines: undefined, initialNotes: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Add another estimate line' }));
    await expect(canvas.getByLabelText('Line 2 description')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();

    await userEvent.click(canvas.getByRole('button', { name: 'Remove line 2' }));
    await expect(canvas.queryByLabelText('Line 2 description')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  },
};

export const TotalsFollowTyping: Story = {
  name: 'Totals follow the lines',
  args: { initialPatientId: '', initialLines: undefined, initialNotes: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText('Line 1 description'), 'Bloods');
    const quantity = canvas.getByLabelText('Line 1 quantity');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '3');
    await userEvent.type(canvas.getByLabelText('Line 1 unit price'), '19.99');
    const tax = canvas.getByLabelText('Line 1 tax percent');
    await userEvent.clear(tax);
    await userEvent.type(tax, '20');

    await expect(totalsValue(canvasElement, 'Subtotal')).toBe('£59.97');
    await expect(totalsValue(canvasElement, 'Tax')).toBe('£11.99');
    await expect(totalsValue(canvasElement, 'Total')).toBe('£71.96');
  },
};

export const Phone: Story = {
  name: 'Phone: labels appear, headers hide',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Below `sm` the column-header row is hidden and every numeric field shows
       its own label instead, so the fields stay identifiable once a value hides
       the placeholder. */
    const label = canvas.getByText('Line 1 quantity');
    await expect(getComputedStyle(label).position).not.toBe('absolute');
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
