import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { DentalExaminationRecord } from '@/app/features/appointments/services/workspaceClinicalService';
import DentalExaminationForm from './DentalExaminationForm';

const ORG_ID = 'org-storybook-dental';
const PATIENT_ID = 'patient-dental';
const ENCOUNTER_ID = 'encounter-dental';

const exam = (
  over: Partial<DentalExaminationRecord> & Pick<DentalExaminationRecord, 'id'>
): DentalExaminationRecord => ({
  organisationId: ORG_ID,
  patientId: PATIENT_ID,
  encounterId: 'encounter-spring',
  examinedAt: '2026-03-14T10:00:00.000Z',
  overallGrade: 'GRADE_1',
  findings: [],
  procedures: [],
  ...over,
});

/** The spring visit: one fractured canine and gingivitis on the upper left carnassial. */
const SPRING_EXAM = exam({
  id: 'exam-spring',
  findings: [
    { tooth: '104', condition: 'FRACTURE', notes: 'Chipped crown tip' },
    { tooth: '208', condition: 'GINGIVITIS', calculus: 2 },
  ],
  calculusScore: 2,
});

/** This visit, already charted once, so the form opens in update mode. */
const TODAY_EXAM = exam({
  id: 'exam-today',
  encounterId: ENCOUNTER_ID,
  examinedAt: '2026-09-28T09:00:00.000Z',
  overallGrade: 'GRADE_2',
  findings: [{ tooth: '104', condition: 'EXTRACTED' }],
  procedures: ['Scale and polish', 'Extraction'],
  notes: 'Recheck in six months.',
});

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

let written: Array<{ method: string; body: Record<string, unknown> }> = [];

/**
 * The form talks to `/v1/pms/organisation/:id/dental-examinations` through the shared axios
 * instance, so its adapter is the seam: the list answers from the fixture (or fails), and a
 * POST or PUT is echoed back as the stored examination and remembered for the play function.
 */
const buildAdapter =
  (records: DentalExaminationRecord[] | 'fail'): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const method = String(config.method ?? 'get').toLowerCase();
    if (method === 'get') {
      return records === 'fail'
        ? Promise.reject(new Error('Network unavailable'))
        : Promise.resolve(respond(config, records));
    }
    const body = JSON.parse(String(config.data ?? '{}')) as Record<string, unknown>;
    written.push({ method, body });
    return Promise.resolve(
      respond(config, exam({ id: 'exam-saved', encounterId: ENCOUNTER_ID, ...body }))
    );
  };

const REAL_ADAPTER = api.defaults.adapter;

const membership = (revoked: string[]): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-dental',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

/**
 * Seeds a real membership on `useOrgStore`, so the form's `appointments:view:any` and
 * `appointments:edit:any` checks run unmocked; `revoked` takes a right away the way a
 * practice would.
 */
const prepare =
  ({
    records = [SPRING_EXAM],
    revoked = [],
  }: {
    records?: DentalExaminationRecord[] | 'fail';
    revoked?: string[];
  }) =>
  () => {
    clearInFlightGetRequests();
    written = [];
    const orgSnapshot = useOrgStore.getState();
    api.defaults.adapter = buildAdapter(records);
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useOrgStore.setState(orgSnapshot);
      clearInFlightGetRequests();
    };
  };

/** Waits for the history to load, which is when the chart becomes selectable. */
const tooth = async (canvasElement: HTMLElement, name: string | RegExp) => {
  const button = await within(canvasElement).findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

const meta = {
  title: 'Workspace/DentalExaminationForm',
  component: DentalExaminationForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Dental tab of the quick-actions Record panel. Teeth are numbered with the ' +
          'Modified Triadan system: quadrants 1 to 4 for permanent teeth and 5 to 8 for ' +
          'deciduous teeth, then the position from the midline. Dogs and cats get their own ' +
          'charts, with the gaps each species has (a cat has no 105). Other species type the ' +
          'number in. Every tooth is a button named with its number, anatomy and state, so the ' +
          'chart works from the keyboard and a screen reader. Viewing needs ' +
          '`appointments:view:any`; recording needs `appointments:edit:any` and an open visit.',
      },
    },
  },
  beforeEach: prepare({}),
  args: {
    organisationId: ORG_ID,
    patientId: PATIENT_ID,
    encounterId: ENCOUNTER_ID,
    species: 'Dog',
  },
  decorators: [
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof DentalExaminationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewExamination: Story = {
  name: 'Dog: chart a tooth against the last visit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const canine = await tooth(canvasElement, 'Tooth 104, right maxillary canine, not charted');
    await expect(canvas.getAllByRole('button', { name: /^Tooth \d{3},/ })).toHaveLength(42);
    const summary = canvas.getByRole('region', { name: 'Previous examination' });
    await expect(summary).toHaveTextContent('104: Fracture · 208: Gingivitis');

    await userEvent.click(canine);
    await expect(canine).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText(/Previous visit: Fracture/)).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText('Condition'), 'EXTRACTED');
    await userEvent.selectOptions(canvas.getByLabelText(/Overall periodontal grade/), 'GRADE_2');
    await userEvent.click(canvas.getByRole('button', { name: 'Save examination' }));

    await expect(await canvas.findByText('Dental examination saved.')).toBeVisible();
    await expect(written).toHaveLength(1);
    await expect(written[0].method).toBe('post');
    await expect(written[0].body).toMatchObject({
      patientId: PATIENT_ID,
      encounterId: ENCOUNTER_ID,
      overallGrade: 'GRADE_2',
      findings: [{ tooth: '104', condition: 'EXTRACTED' }],
    });
    await expect(
      canvas.getByRole('button', { name: 'Tooth 104, right maxillary canine, extracted recorded' })
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Update examination' })).toBeEnabled();
  },
};

export const KeyboardOnly: Story = {
  name: 'Dog: chart from the keyboard',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const incisor = await tooth(
      canvasElement,
      'Tooth 101, right maxillary first incisor, not charted'
    );
    incisor.focus();
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: 'Tooth 102, right maxillary second incisor, not charted' })
    ).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('heading', { name: 'Tooth 102' })).toBeVisible();
    await expect(canvas.getByText('Right maxillary second incisor')).toBeVisible();
  },
};

export const ExistingExamination: Story = {
  name: 'Dog: reopen this visit to update it',
  beforeEach: prepare({ records: [TODAY_EXAM, SPRING_EXAM] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const canine = await tooth(
      canvasElement,
      'Tooth 104, right maxillary canine, extracted recorded'
    );
    await expect(canvas.getByLabelText(/Overall periodontal grade/)).toHaveValue('GRADE_2');
    await expect(canvas.getByLabelText('Examination notes')).toHaveValue('Recheck in six months.');
    await userEvent.click(canine);
    await expect(canvas.getByLabelText('Condition')).toHaveValue('EXTRACTED');
    await userEvent.clear(canvas.getByLabelText('Examination notes'));
    await userEvent.click(canvas.getByRole('button', { name: 'Update examination' }));
    await expect(await canvas.findByText('Dental examination saved.')).toBeVisible();
    await expect(written[0].method).toBe('put');
    await expect(written[0].body).toMatchObject({ notes: null, overallGrade: 'GRADE_2' });
  },
};

export const FelineDeciduous: Story = {
  name: 'Cat: deciduous chart',
  args: { species: 'Cat' },
  beforeEach: prepare({ records: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await tooth(canvasElement, /^Tooth 101,/);
    await expect(canvas.getByText(/Feline · Modified Triadan/)).toBeVisible();
    await expect(canvas.getAllByRole('button', { name: /^Tooth \d{3},/ })).toHaveLength(30);
    await expect(canvas.queryByRole('button', { name: /^Tooth 105,/ })).not.toBeInTheDocument();

    const dentition = canvas.getByRole('group', { name: 'Dentition' });
    await userEvent.click(within(dentition).getByRole('button', { name: 'Deciduous' }));
    await expect(canvas.getAllByRole('button', { name: /^Tooth \d{3},/ })).toHaveLength(26);
    await expect(
      canvas.getByRole('button', {
        name: 'Tooth 504, right maxillary deciduous canine, not charted',
      })
    ).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^Tooth 706,/ })).not.toBeInTheDocument();
  },
};

export const OtherSpecies: Story = {
  name: 'Other species: type the tooth number',
  args: { species: 'Rabbit' },
  beforeEach: prepare({ records: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole('textbox', { name: 'Tooth number' });
    await waitFor(() => expect(input).toBeEnabled());
    await userEvent.type(input, '120{Enter}');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByText(/quadrant from 1 to 8/)).toBeVisible();

    await userEvent.clear(input);
    await userEvent.type(input, '306{Enter}');
    await expect(canvas.getByRole('heading', { name: 'Tooth 306' })).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText('Condition'), 'TOOTH_RESORPTION');
    const charted = canvas.getByRole('list', { name: 'Charted teeth' });
    await expect(
      within(charted).getByRole('button', {
        name: 'Tooth 306, left mandibular second premolar, tooth resorption recorded',
      })
    ).toBeVisible();
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission: review only',
  beforeEach: prepare({ records: [TODAY_EXAM], revoked: ['appointments:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const canine = await tooth(
      canvasElement,
      'Tooth 104, right maxillary canine, extracted recorded'
    );
    await expect(canvas.getByText(/permission to edit appointments/)).toBeVisible();
    await userEvent.click(canine);
    await expect(canvas.getByLabelText('Condition')).toHaveValue('EXTRACTED');
    await expect(canvas.getByLabelText('Condition')).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: /examination$/ })).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'History failed to load',
  beforeEach: prepare({ records: 'fail' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Unable to load previous dental findings. Please try again.'
    );
    await expect(canvas.getByRole('button', { name: 'Save examination' })).toBeDisabled();
    await expect(canvas.getByLabelText(/Overall periodontal grade/)).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Retry loading previous findings' })
    ).toBeVisible();
  },
};

export const Phone: Story = {
  name: 'Phone: chart wraps inside the drawer',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await tooth(canvasElement, /^Tooth 311,/);
    const root = canvasElement.firstElementChild as HTMLElement;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};
