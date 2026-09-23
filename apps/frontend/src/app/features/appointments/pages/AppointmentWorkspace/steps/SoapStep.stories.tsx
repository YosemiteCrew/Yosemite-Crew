import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import type {
  AppointmentEncounter,
  SoapNoteEntry,
} from '@/app/features/appointments/types/workspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import SoapStep from './SoapStep';

const APPOINTMENT_ID = 'appt-workspace-1';

const NATIVE_TITLES = [
  'Subjective (History)',
  'Objective (Examination)',
  'Assessment (Differential)',
  'Plan',
];

/**
 * The VISIBLE section heading, with the screen-reader layer filtered out.
 *
 * "Plan" is in this tree twice, and both copies are correct. `SectionContainer`
 * draws the heading, and the `RichTextEditor` nested inside it draws its own
 * `<span class="sr-only">` carrying the editor's `ariaLabel`. For three of the
 * four sections those two strings differ ("Subjective (History)" heading vs
 * "Subjective history" label), so nobody noticed; for Plan they are the same
 * word, so a bare `getByText('Plan')` matches two elements and throws
 * "Found multiple elements".
 *
 * Worth being precise about which duplication this is, because it decides how
 * every future query against this component has to be written: it is NOT the
 * section rendered twice (a desktop tree and a stacked phone tree both mounted),
 * and it is NOT the preview decorator's sr-only story-title banner. It is one
 * section carrying one hidden label. `.sr-only` excludes both that label and the
 * decorator's banner, so this is the query to reach for either way. `script,
 * style` is restated because passing `ignore` replaces the default rather than
 * adding to it.
 */
const sectionTitle = (canvas: ReturnType<typeof within>, title: string) =>
  canvas.getByText(title, { ignore: 'script, style, .sr-only' });

/**
 * A custom template's typed fields. Two are required and one is not, so the
 * validation message has something to leave out - a schema where everything is
 * required cannot tell a working validator from one that lists every field.
 */
const CUSTOM_SCHEMA: FormField[] = [
  { id: 'presenting_signs', type: 'textarea', label: 'Presenting signs' },
  { id: 'pain_score', type: 'input', label: 'Pain score (0-10)', required: true },
  {
    id: 'lameness_grade',
    type: 'radio',
    label: 'Lameness grade',
    required: true,
    options: [
      { label: 'Grade I', value: '1' },
      { label: 'Grade II', value: '2' },
      { label: 'Grade III', value: '3' },
    ],
  },
];

const draft = (over: Partial<SoapNoteEntry> = {}): SoapNoteEntry => ({
  id: 'draft',
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  status: 'IN_PROGRESS',
  createdAt: '2026-03-12T09:40:00.000Z',
  ...over,
});

const encounter = (over: Partial<AppointmentEncounter> = {}): AppointmentEncounter => ({
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  leadId: 'prac-amara',
  leadName: 'Dr. Amara Weber',
  alerts: [],
  soap: [draft()],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'IN_PROGRESS',
    DIAGNOSTICS: 'EMPTY',
    TREATMENT: 'EMPTY',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
  ...over,
});

const CUSTOM_ENCOUNTER = encounter({
  soap: [
    draft({
      templateId: 'tpl-ortho',
      customSchema: CUSTOM_SCHEMA,
      customAnswers: { presenting_signs: 'Left forelimb lameness after a fall in the park.' },
    }),
  ],
});

const meta = {
  title: 'Workspace/SoapStep',
  component: SoapStep,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The SOAP step. Its default rendering - four rich-text sections and a vitals aside - is ' +
          'the only one that had ever been drawn, and it is the least interesting of the three ' +
          'trees this component can produce.\n\n' +
          '**Custom-template mode replaces the note entirely.** When the applied template carries ' +
          'a `customSchema`, `isCustomSoap` flips and `CustomSoapFields` renders the shared ' +
          '`FormRenderer` in place of `NativeSoapFields`. Subjective / Objective / Assessment / ' +
          'Plan are not hidden or disabled - they are not rendered at all, and the section is ' +
          'retitled "Clinical note". Nothing about the props says this; it is decided by one ' +
          'boolean read off the active draft.\n\n' +
          '**The required-field alert** only exists in custom mode. Native SOAP has no required ' +
          'fields, so `Save & Next` on an empty native note just advances. In custom mode the same ' +
          'button collects the unanswered required labels and refuses, with a `role="alert"` ' +
          'banner naming them.\n\n' +
          '**The lock banner** is the readOnly branch: the chip, the template search, the editors ' +
          'and the action row all disappear together, and a single `bg-neutral-100` paragraph ' +
          'takes their place - but only when the lock carries a reason. The client-derived lock ' +
          '(`viewOnly`, no backend `sectionLocks`) has no reason, so it renders an empty column, ' +
          'which is drawn here as its own story.\n\n' +
          'No service is stubbed: `organisationId` is left undefined, which is what keeps the ' +
          'auto-template resolver and the save off the network. Neither `Save & Next` story ' +
          'reaches the persist path either - the native one returns on the empty-note branch and ' +
          'the custom one is refused by validation - so both are exercising real code with no ' +
          'request behind it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    appointmentReason: 'Limping on the front left leg since yesterday evening.',
    appointmentSpeciality: 'Orthopaedics',
    appointmentService: 'Lameness consultation',
    encounter: encounter(),
    visitStarted: true,
    onRecordVitals: fn(),
    onSaveAndNext: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    useAppointmentWorkspaceStore.setState({ saveStatusByAppointmentId: {} });
  },
} satisfies Meta<typeof SoapStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NativeFields: Story = {
  name: 'Native S/O/A/P',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    for (const title of NATIVE_TITLES) {
      await expect(sectionTitle(canvas, title)).toBeInTheDocument();
    }
    await expect(canvas.queryByText('Clinical note')).not.toBeInTheDocument();

    /* The Plan section is the one place where the heading and the editor's
       accessible name are the same string, so "Plan" is in the DOM twice: the
       heading, and RichTextEditor's own sr-only label span. Named here rather
       than filtered away silently, because it is the reason `sectionTitle`
       exists and it is exactly one section, not two. */
    await expect(canvas.getAllByText('Plan')).toHaveLength(2);
    const planEditor = await canvas.findByRole('textbox', { name: 'Plan' });
    await expect(planEditor).toBeInTheDocument();

    /* Native SOAP has no required fields at all, so an empty note advances rather
       than validating - the contrast that makes the custom-mode alert meaningful.
       `handleSaveAndNext` returns on its first branch here (`!customMode &&
       !hasNativeSoapContent`), so it never reaches the persist path at all and the
       callback is the whole observable effect. Nothing is stubbed to achieve that. */
    await userEvent.click(canvas.getByRole('button', { name: 'Save & Next' }));
    await waitFor(() => {
      expect(args.onSaveAndNext).toHaveBeenCalled();
    });
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default tree. Four `SectionContainer` editors down the left, the vitals panel in a ' +
          '360px aside, and the read-only "All SOAP notes" list underneath - empty here, because ' +
          'only signed notes move into it.\n\n' +
          'One thing to know before writing a query against this component: each editor renders ' +
          'its `ariaLabel` a second time as an `sr-only` span, so the Plan section - the only one ' +
          'whose heading and editor label are the same word - puts "Plan" in the DOM twice. There ' +
          "is one Plan section, not two; a bare `getByText('Plan')` throws all the same.",
      },
    },
  },
};

export const CustomTemplateFields: Story = {
  name: 'Custom template replaces the sections',
  args: { encounter: CUSTOM_ENCOUNTER },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Clinical note')).toBeInTheDocument();

    /* The native editors are GONE, not hidden. Asserting the custom fields appeared
       would pass with both trees rendered one under the other, which is the failure
       this swap would actually produce. */
    for (const title of NATIVE_TITLES) {
      await expect(canvas.queryByText(title)).not.toBeInTheDocument();
    }

    // Every schema field is rendered, by its own label, through FormRenderer.
    await expect(canvas.getByLabelText('Presenting signs')).toHaveValue(
      'Left forelimb lameness after a fall in the park.'
    );
    await expect(canvas.getByLabelText('Pain score (0-10)')).toHaveValue('');
    await expect(canvas.getByText('Lameness grade')).toBeInTheDocument();
    /* A radio field renders one input per option with a composed accessible name,
       and none is preselected - which is what leaves it unanswered for the
       validation story below. */
    const grades = canvas.getAllByRole('radio');
    await expect(grades).toHaveLength(3);
    await expect(canvas.getByRole('radio', { name: 'Lameness grade: Grade II' })).not.toBeChecked();

    // Record Vitals survives the swap - it is inside CustomSoapFields too.
    await expect(canvas.getByRole('button', { name: 'Record vitals' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A template whose `customSchema` carries three typed fields. The answers are keyed by ' +
          'field id and stored on the draft, so the pre-filled textarea here is real state rather ' +
          'than a default - which is what makes the empty required fields below it unanswered.',
      },
    },
  },
};

export const RequiredFieldsAlert: Story = {
  name: 'Save blocked by required fields',
  args: { encounter: CUSTOM_ENCOUNTER },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Save & Next' }));

    /* The banner names the missing labels, in schema order, and leaves out the one
       optional field that IS answered. A regex on "required field" would pass with
       an empty list, which is the regression worth catching. */
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent(
      'Please complete required field(s): Pain score (0-10), Lameness grade'
    );
    await expect(alert.textContent).not.toContain('Presenting signs');

    // It refuses rather than advancing: the step never moves on.
    await expect(args.onSaveAndNext).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only validation gate in the SOAP step, and it exists solely in custom-template ' +
          'mode. The banner is a `rounded-2xl bg-danger-100` block that appears between the fields ' +
          'and the action row, so it pushes Save & Next down - worth seeing rendered, since it is ' +
          'the one thing standing between an incomplete structured note and a signed artifact.',
      },
    },
  },
};

export const LockedWithReason: Story = {
  name: 'Read-only with a lock reason',
  args: {
    encounter: encounter({
      viewOnly: true,
      sectionLocks: {
        soap: {
          locked: true,
          reason:
            'This visit was discharged on 12 March, so the SOAP note is locked. Add an addendum ' +
            'from the records panel instead.',
        },
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/This visit was discharged on 12 March/)).toBeInTheDocument();

    /* readOnly removes the whole editing block in one branch, so all four of these
       go together. Checking only that the banner appeared would pass with the
       editors still sitting under it. */
    for (const title of NATIVE_TITLES) {
      await expect(canvas.queryByText(title)).not.toBeInTheDocument();
    }
    await expect(canvas.queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('searchbox', { name: /template/i })).not.toBeInTheDocument();

    // The context header and the vitals aside stay: only the left editing column locks.
    await expect(canvas.getByRole('heading', { name: 'SOAP note' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Limping on the front left leg since yesterday evening.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The backend-owned lock. `resolveSectionLock` prefers `sectionLocks.soap` over the ' +
          "client-derived `viewOnly`, so the reason string is the backend's own words rather than " +
          'anything the client composes - which is why it is worth rendering a long one here.',
      },
    },
  },
};

export const LockedWithoutReason: Story = {
  name: 'Read-only with no reason (empty column)',
  args: { encounter: encounter({ viewOnly: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The client-derived lock resolves to `{ locked: true }` with NO reason, and the
       banner is gated on `readOnly && lockReason`. So the entire left column renders
       nothing: no editors, no explanation, just whitespace next to the vitals panel.
       Drawn deliberately - this is the state a completed visit lands in whenever the
       bootstrap has not supplied sectionLocks. */
    for (const title of NATIVE_TITLES) {
      await expect(canvas.queryByText(title)).not.toBeInTheDocument();
    }
    await expect(canvas.queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();

    /* Not "no banner" - NOTHING. The left column is the aside's previous sibling,
       and it renders zero children in this state. A text-absence check could not
       tell an empty column apart from one holding some other explanation. */
    const aside = canvasElement.querySelector('aside') as HTMLElement;
    const leftColumn = aside.previousElementSibling as HTMLElement;
    await expect(leftColumn.children).toHaveLength(0);

    // Everything outside the locked column is still there, which is what makes the
    // gap read as a hole rather than as an empty step.
    await expect(canvas.getByRole('heading', { name: 'SOAP note' })).toBeInTheDocument();
    await expect(canvas.getByText('All SOAP notes')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same lock, no reason. Worth keeping next to the story above: the two differ by one ' +
          'optional string, and the difference between them is a full explanation and a blank ' +
          'column.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: aside stacks under the note',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const subjective = sectionTitle(canvas, 'Subjective (History)');
    const vitals = canvas.getByText('Vitals');
    // `lg:flex-row` collapses below 1024px, so the 360px aside drops beneath the
    // editors instead of sitting beside them.
    await expect(vitals.getBoundingClientRect().top).toBeGreaterThan(
      subjective.getBoundingClientRect().bottom
    );

    /* Stacking is a layout change, not a content change: all four editors, the
       vitals card and the notes list are still here. Worth asserting, because the
       cheap way to "fix" a cramped phone layout is to hide something, and that
       would still satisfy the geometry check above. Queried through
       `sectionTitle`: "Plan" resolves to two nodes at every viewport (heading +
       the editor's sr-only label), which is a property of the component, not of
       the breakpoint - there is no second, hidden phone tree here. */
    for (const title of NATIVE_TITLES) {
      await expect(sectionTitle(canvas, title)).toBeInTheDocument();
    }
    await expect(canvas.getByText('No vitals recorded yet.')).toBeInTheDocument();
    await expect(canvas.getByText('All SOAP notes')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save & Next' })).toBeInTheDocument();

    /* The aside is `w-full` once it stops being an aside, so it matches the editing
       column rather than keeping its 360px desktop track. That equality is the
       observable difference between "collapsed" and "still 360px, just wrapped". */
    const aside = canvasElement.querySelector('aside') as HTMLElement;
    const leftColumn = aside.previousElementSibling as HTMLElement;
    await expect(aside.getBoundingClientRect().width).toBe(
      leftColumn.getBoundingClientRect().width
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "At 375px the two-column step becomes one column and the context header's three fields " +
          '(chief complaint, speciality, service) stack as well.',
      },
    },
  },
};
