import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import HistoryEntryCard from './HistoryEntryCard';
import { StatusPillSelect, StructuredResultsPanel } from './CompanionHistoryTimeline';
import type { HistoryEntry } from '@/app/features/companionHistory/types/history';
import { AppointmentLabels } from '@/app/config/statusConfig';
import {
  formatHistoryDate,
  formatHistoryDateTime,
} from '@/app/features/companionHistory/utils/historyFormatters';

/**
 * Local date parts, never a `...Z` literal. The card formats `occurredAt` through
 * `Intl` in the runner's timezone, so a UTC string slides a day either side of the
 * date line and the dedup fixtures below - which have to match the formatted date
 * exactly - would pass or fail by machine.
 */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 2, day, hour, minute).toISOString();

/**
 * Testing Library collapses whitespace in the DOM text before it compares. The
 * date formatter emits a narrow no-break space before AM/PM, so an expected string
 * built from the same formatter has to be collapsed the same way or the two never
 * match despite reading identically.
 */
const collapse = (value: string) => value.replaceAll(/\s+/gu, ' ').trim();

const APPOINTMENT: HistoryEntry = {
  id: 'hist-appt-1',
  type: 'APPOINTMENT',
  occurredAt: at(12, 9, 5),
  status: 'checked_in',
  title: 'Annual wellness exam',
  subtitle: 'Consult 2 - 30 minutes',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  link: { kind: 'appointment', id: 'appt-1', appointmentId: 'appt-1', companionId: 'companion-1' },
  source: 'appointments',
  payload: {},
};

const LAB_RESULT: HistoryEntry = {
  id: 'hist-lab-1',
  type: 'LAB_RESULT',
  occurredAt: at(12, 11, 20),
  status: 'COMPLETED',
  title: 'Complete blood count',
  subtitle: 'IDEXX ProCyte Dx',
  summary: 'Mild regenerative anaemia. Recheck haematocrit in ten days.',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  tags: ['haematology'],
  link: { kind: 'labResult', id: 'lab-1', appointmentId: 'appt-1' },
  source: 'idexx',
  payload: {},
};

/**
 * A record with three sources of chips at once: `payload.fileName`, the
 * `payload.attachments` array, and - deliberately - one attachment whose name is
 * only whitespace, which must not become a chip.
 */
const DOCUMENT_ENTRY: HistoryEntry = {
  id: 'hist-doc-1',
  type: 'DOCUMENT',
  occurredAt: at(12, 14, 5),
  title: 'Rabies vaccination certificate',
  subtitle: 'Uploaded by the parent',
  actor: { id: 'parent-1', name: 'Nina Alvarez', role: 'PARENT' },
  link: { kind: 'document', id: 'doc-rabies-2026', companionId: 'companion-1' },
  source: 'documents',
  payload: {
    fileName: 'rabies-certificate-2026.pdf',
    attachments: [{ name: 'lab-report.pdf' }, 'consent-form.pdf', { name: '   ' }],
  },
};

const EVERY_TYPE: HistoryEntry[] = [
  APPOINTMENT,
  {
    id: 'hist-task-1',
    type: 'TASK',
    occurredAt: at(12, 10, 0),
    status: 'IN_PROGRESS',
    title: 'Chase the referral letter',
    actor: { id: 'staff-1', name: 'Priya Raman', role: 'STAFF' },
    link: { kind: 'task', id: 'task-1' },
    source: 'tasks',
    payload: {},
  },
  {
    id: 'hist-form-1',
    type: 'FORM_SUBMISSION',
    occurredAt: at(12, 10, 40),
    status: 'SIGNED',
    title: 'Anaesthetic consent',
    link: { kind: 'formSubmission', id: 'form-1' },
    source: 'forms',
    payload: {},
  },
  DOCUMENT_ENTRY,
  LAB_RESULT,
  {
    id: 'hist-invoice-1',
    type: 'INVOICE',
    occurredAt: at(12, 17, 15),
    status: 'PAID',
    title: 'Invoice for the wellness visit',
    link: { kind: 'invoice', id: 'inv-481', appointmentId: 'appt-1' },
    source: 'finance',
    payload: { invoiceNumber: 'INV-2026-0481' },
  },
];

const DEDUP_DATE = at(5, 9, 0);
const PREFIX_DATE = at(6, 15, 30);

const DEDUP_ENTRIES: HistoryEntry[] = [
  {
    id: 'dedup-exact',
    type: 'DOCUMENT',
    occurredAt: DEDUP_DATE,
    // Exactly what the meta line already renders, which is how the history API
    // returns a lot of imported records.
    subtitle: formatHistoryDate(DEDUP_DATE),
    title: 'Imported vaccination card',
    link: { kind: 'document', id: 'doc-import-1' },
    source: 'documents',
    payload: {},
  },
  {
    id: 'dedup-prefix',
    type: 'LAB_RESULT',
    occurredAt: PREFIX_DATE,
    subtitle: `${formatHistoryDate(PREFIX_DATE)} • IDEXX ProCyte Dx`,
    title: 'Biochemistry profile',
    link: { kind: 'labResult', id: 'lab-2' },
    source: 'idexx',
    payload: {},
  },
];

const META_ENTRIES: HistoryEntry[] = [
  {
    id: 'meta-bare',
    type: 'DOCUMENT',
    occurredAt: at(2, 8, 15),
    title: 'Insurance claim form',
    link: { kind: 'document', id: 'doc-9' },
    source: 'documents',
    payload: {},
  },
  {
    // An actor the org no longer stores a name for: the row falls back to the
    // role label rather than printing the raw enum or a dangling separator.
    id: 'meta-role',
    type: 'FORM_SUBMISSION',
    occurredAt: at(3, 10, 30),
    title: 'Pre-visit questionnaire',
    actor: { id: 'user-7', role: 'PARENT' },
    link: { kind: 'formSubmission', id: 'form-7' },
    source: 'forms',
    payload: {},
  },
  {
    // Both a payload lead and an actor. The payload wins.
    id: 'meta-lead',
    type: 'APPOINTMENT',
    occurredAt: at(4, 16, 45),
    title: 'Dental scale and polish',
    actor: { id: 'vet-2', name: 'Dr. Weber', role: 'VET' },
    link: { kind: 'appointment', id: 'appt-9' },
    source: 'appointments',
    payload: { leadVetName: 'Dr. Amara Osei' },
  },
];

/** Structurally the module-private `DetailPair` the timeline builds in `getLabResults`. */
type ResultRow = {
  label: string;
  value: string;
  range?: string;
  abnormal?: boolean;
  direction?: string;
};

const CBC_RESULTS: ResultRow[] = [
  { label: 'Haematocrit', value: '33 %', range: '37 - 55', abnormal: true, direction: '↓' },
  { label: 'Haemoglobin', value: '11.2 g/dL', range: '12 - 18', abnormal: true, direction: '↓' },
  { label: 'Platelets', value: '412 K/uL', range: '148 - 484' },
];

/** The card is an `<li>`; the timeline renders it inside `<ol className="flex flex-col">`. */
const InTimeline = (Story: React.ComponentType) => (
  <ol className="flex flex-col">
    <Story />
  </ol>
);

/** Stands in for the timeline's module-private `InsetChipButton`. */
const RESULT_PDF_CHIP = (
  <button
    type="button"
    className="inline-flex items-center rounded-[9px] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-body)]"
    style={{ background: 'var(--inset)' }}
  >
    Result PDF
  </button>
);

const LONG_TITLE = 'Pre-anaesthetic haematology and biochemistry profile with electrolytes';

const meta = {
  title: 'Companions/HistoryEntryCard',
  component: HistoryEntryCard,
  decorators: [InTimeline],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One row of a companion history timeline. Everything it draws is derived from the ' +
          'record plus three optional slots, and almost all of the derivation is invisible in a ' +
          'screenshot.\n\n' +
          'The title button carries no visible label of its own - its accessible name is the ' +
          "per-type action ('Open file', 'Open result', 'Open finance', 'Open submission', " +
          "'Open task', 'Open appointment'), and it sits beside a second, near-identical " +
          'chevron button that opens the detail drawer instead. Statuses arrive SCREAMING_CASE ' +
          'and are title-cased for display, so the raw token leaking through is a real failure ' +
          'mode. The meta line is `<date · time> · <who>`, where "who" resolves through the ' +
          'payload lead, then the actor name, then a role label, and must not leave a dangling ' +
          'separator when all three are missing. And a subtitle that only repeats the date the ' +
          'meta line already shows is dropped, prefix and all.\n\n' +
          '`statusSlot` REPLACES the derived badge rather than sitting next to it, attachment ' +
          'chips come from three different payload shapes (a file name, an attachments array, an ' +
          'invoice number) with blank names filtered out, and `isLast` is what drops the ' +
          'connector line so the spine stops at the final row instead of trailing into nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    entry: APPOINTMENT,
    onOpen: fn(),
    onOpenDetail: fn(),
  },
} satisfies Meta<typeof HistoryEntryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Appointment row',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Two buttons in one row that both "open" the record, and the only thing
       telling them apart is an accessible name nobody can see. Wiring them to
       each other's handler would look identical on screen. */
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open record detail for Annual wellness exam' })
    );
    await expect(args.onOpenDetail).toHaveBeenCalledTimes(1);
    await expect(args.onOpen).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Open appointment' }));
    await expect(args.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'hist-appt-1' }));

    // The stored value is `checked_in`; the row shows a title-cased label and the
    // raw token must not survive anywhere in the markup.
    await expect(canvas.getByText('Checked In')).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toContain('checked_in');
  },
};

export const EditableStatus: Story = {
  name: 'Editable status pill in the slot',
  args: {
    entry: { ...APPOINTMENT, status: 'requested', title: 'New booking - limping, left hind' },
    statusSlot: <StatusPillSelect status="requested" options={AppointmentLabels} onChange={fn()} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* `statusSlot ?? <Badge/>` - the slot REPLACES the derived badge. Turn that
       into a stacked render and the row carries two pills saying the same thing,
       which reads as a rendering glitch rather than a bug. */
    await expect(canvas.getAllByText('Requested')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  },
};

export const LabResultExpanded: Story = {
  name: 'Lab result with its results panel open',
  args: {
    entry: LAB_RESULT,
    actions: RESULT_PDF_CHIP,
    expandedContent: <StructuredResultsPanel entry={LAB_RESULT} results={CBC_RESULTS} />,
    isLast: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const top = (text: string) => canvas.getByText(text).getBoundingClientRect();

    /* The card stacks five independent blocks in one column and nothing in the
       markup forces the order: subtitle, summary, chips/actions, expanded panel,
       tags. Reordering any pair still renders - it just puts the results table
       above the action that opened it, or the tags above the results. */
    await expect(top('IDEXX ProCyte Dx').bottom).toBeLessThanOrEqual(
      top('Mild regenerative anaemia. Recheck haematocrit in ten days.').top
    );
    await expect(top('Result PDF').bottom).toBeLessThanOrEqual(top('Haematocrit').top);
    await expect(top('Haematocrit').bottom).toBeLessThanOrEqual(top('haematology').top);
  },
};

export const DocumentWithAttachments: Story = {
  name: 'Document with attachment chips',
  args: { entry: DOCUMENT_ENTRY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const fileChip = canvas.getByText('rabies-certificate-2026.pdf');
    const chipRow = fileChip.parentElement;
    /* Three chips, not four: the payload also carries an attachment whose name is
       whitespace only, and an empty chip is a 20px grey smudge nobody can explain. */
    await expect(chipRow?.children).toHaveLength(3);
    await expect(chipRow?.children[0]).toBe(fileChip);
    await expect(chipRow?.children[1]).toHaveTextContent('lab-report.pdf');
    await expect(chipRow?.children[2]).toHaveTextContent('consent-form.pdf');

    /* A document has no status, so the header row is title + meta and nothing
       else. The badge branch rendering an empty pill would show as a bare
       rounded outline sitting in the gap. */
    const header = canvas.getByRole('button', { name: 'Open file' }).parentElement;
    await expect(header?.children).toHaveLength(2);
  },
};

export const EveryType: Story = {
  name: 'One row of every entry type',
  render: (args) => (
    <>
      {EVERY_TYPE.map((entry, index) => (
        <HistoryEntryCard
          key={entry.id}
          {...args}
          entry={entry}
          isLast={index === EVERY_TYPE.length - 1}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvasElement.querySelectorAll('li');
    await expect(rows).toHaveLength(6);

    /* Six types, six accessible names, and none of them are on screen: the button
       shows the record title. A type falling through to the wrong branch renames
       the control for a screen reader only. */
    const openLabels = [
      'Open appointment',
      'Open task',
      'Open submission',
      'Open file',
      'Open result',
      'Open finance',
    ];
    const found = openLabels.map((name) => canvas.queryByRole('button', { name }));
    await expect(found.filter(Boolean)).toHaveLength(6);

    // The invoice number becomes its own chip, prefixed - the raw number alone
    // would read as a phone number next to the file chips.
    await expect(canvas.getByText('Invoice #INV-2026-0481')).toBeInTheDocument();

    /* The spine holds the type glyph plus, on every row but the last, the
       connector. `isLast` is the only thing stopping the line from trailing off
       the bottom of the timeline into whatever follows it. */
    const spines = [...rows].map((row) => row.firstElementChild?.children.length);
    await expect(spines).toEqual([2, 2, 2, 2, 2, 1]);
  },
};

export const ActiveRow: Story = {
  name: 'The row open in the detail drawer',
  render: (args) => (
    <>
      <HistoryEntryCard {...args} entry={APPOINTMENT} active />
      <HistoryEntryCard {...args} entry={LAB_RESULT} isLast />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [activeRow, plainRow] = canvasElement.querySelectorAll('li');
    const activeStyle = globalThis.getComputedStyle(activeRow);
    const plainStyle = globalThis.getComputedStyle(plainRow);

    /* The selected-row chrome is three separate things - the class swap for the
       radius and padding, and an inline style for the surface, the hairline and
       the 3px ring. Any one of them dropping still renders a perfectly ordinary
       row, so the only proof is measuring it against an unselected neighbour. */
    await expect(plainStyle.borderTopWidth).toBe('0px');
    await expect(plainStyle.paddingLeft).toBe('0px');
    await expect(activeStyle.borderTopWidth).toBe('1px');
    await expect(activeStyle.paddingLeft).toBe('8px');
    await expect(activeStyle.borderTopLeftRadius).toBe('14px');
    await expect(activeStyle.boxShadow).toContain('3px');
    await expect(activeStyle.backgroundColor).not.toBe(plainStyle.backgroundColor);
  },
};

export const SubtitleDedup: Story = {
  name: 'Subtitles that only repeat the date',
  render: (args) => (
    <>
      {DEDUP_ENTRIES.map((entry, index) => (
        <HistoryEntryCard
          key={entry.id}
          {...args}
          entry={entry}
          isLast={index === DEDUP_ENTRIES.length - 1}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The meta line already prints the date. A subtitle that is only the date is
       dropped entirely rather than printed under it - the imported records that
       arrive this way would otherwise show the same date twice, two lines apart. */
    await expect(canvas.queryAllByText(formatHistoryDate(DEDUP_DATE))).toHaveLength(0);

    // A subtitle that leads with the date keeps only the part the meta line does
    // not already say.
    await expect(canvas.getByText('IDEXX ProCyte Dx')).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toContain(`${formatHistoryDate(PREFIX_DATE)} •`);
  },
};

export const MetaLine: Story = {
  name: 'Who the meta line credits',
  render: (args) => (
    <>
      {META_ENTRIES.map((entry, index) => (
        <HistoryEntryCard
          key={entry.id}
          {...args}
          entry={entry}
          isLast={index === META_ENTRIES.length - 1}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stamp = (entry: HistoryEntry) => collapse(formatHistoryDateTime(entry.occurredAt));

    /* No actor and no payload lead: the line is the timestamp and nothing else.
       The separator is interpolated, so getting this wrong prints "9:42 AM ·"
       with nothing after it. */
    await expect(canvas.getByText(stamp(META_ENTRIES[0]))).toBeInTheDocument();

    // A nameless actor is credited by role, from a map with no visible source.
    await expect(canvas.getByText(`${stamp(META_ENTRIES[1])} · Pet parent`)).toBeInTheDocument();

    /* The payload lead outranks the actor: the acting user on a record is often
       the receptionist who filed it, not the vet who owns the case. */
    await expect(
      canvas.getByText(`${stamp(META_ENTRIES[2])} · Dr. Amara Osei`)
    ).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toContain('Dr. Weber');
    await expect(canvasElement.textContent).not.toContain('PARENT');
  },
};

export const Phone: Story = {
  name: 'Phone: a long title clips rather than wrapping',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { entry: { ...APPOINTMENT, title: LONG_TITLE }, isLast: true },
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByText(LONG_TITLE);
    const style = globalThis.getComputedStyle(title);

    /* `truncate` is one utility standing in for three declarations. If it resolves
       to nothing the title wraps to three lines on a phone and shoves the status
       badge and the meta line out of the header row. */
    await expect(style.whiteSpace).toBe('nowrap');
    await expect(style.textOverflow).toBe('ellipsis');
    await expect(style.overflow).toBe('hidden');

    // Nothing in the row may push the page sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
