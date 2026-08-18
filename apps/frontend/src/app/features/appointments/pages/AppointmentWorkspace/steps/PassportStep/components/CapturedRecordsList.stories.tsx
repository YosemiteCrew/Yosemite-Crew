import type { Meta, StoryObj } from '@storybook/react';
import CapturedRecordsList from './CapturedRecordsList';
import type { PassportRecordRow } from '../passportRecordRows';

// Rows as the step assembles them: everything captured in this visit is a DRAFT
// and is unshifted in front of the SIGNED rows the assembled passport returned.
const draftVaccination: PassportRecordRow = {
  id: 'vac-draft',
  kind: 'VACCINATION',
  title: 'Nobivac Rabies',
  detail: 'Rabies · given Feb 14, 2026',
  status: 'DRAFT',
};

const draftExam: PassportRecordRow = {
  id: 'exam-draft',
  kind: 'EXAM',
  title: 'Fit for travel',
  detail: 'Examined Feb 14, 2026, 09:30',
  status: 'DRAFT',
};

const signedRabies: PassportRecordRow = {
  id: 'vac-signed',
  kind: 'VACCINATION',
  title: 'Nobivac Rabies',
  detail: 'Rabies · given Jan 4, 2026',
  status: 'SIGNED',
};

const signedTitration: PassportRecordRow = {
  id: 'tit-signed',
  kind: 'TITRATION',
  title: '1.8 IU/ml',
  detail: 'Biobest Laboratories · sampled Jan 25, 2026',
  status: 'SIGNED',
};

const signedTreatment: PassportRecordRow = {
  id: 'par-signed',
  kind: 'TREATMENT',
  title: 'Milbemax',
  detail: 'Echinococcus · treated Feb 2, 2026, 16:45',
  status: 'SIGNED',
};

const signedNotFit: PassportRecordRow = {
  id: 'exam-signed',
  kind: 'EXAM',
  title: 'Not fit for travel',
  detail: 'Examined Dec 12, 2025, 11:15',
  status: 'SIGNED',
};

const meta = {
  title: 'Workspace/Passport/CapturedRecordsList',
  component: CapturedRecordsList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every passport record for the companion, with its attestation state on each row. A ' +
          'record captured in the visit is a DRAFT - saved against the encounter but off the ' +
          'passport - and only becomes SIGNED once a veterinarian attests it, which is a separate ' +
          'act on the passport itself rather than an affordance of this step. That is why the rows ' +
          'here carry no sign/attest control for any role: the list is read-only for vet and ' +
          'non-vet alike, and the state is spelled out on every row rather than implied by ' +
          'position.\n\nDRAFT uses the `accent` StatusPill tone and SIGNED the `success` tone, so ' +
          'the two are distinguishable without reading the label - the stories below exist mainly ' +
          'to keep that pair honest in both themes.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    rows: [draftVaccination, signedRabies, signedTitration],
    isLoading: false,
    loadError: null,
  },
} satisfies Meta<typeof CapturedRecordsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The normal case: a dose captured in this visit sitting above what the
 * passport already carries, so the DRAFT/SIGNED pair is visible side by side.
 */
export const DraftAndSigned: Story = {};

/**
 * First paint, while `getPetPassport` is still in flight. The explanatory copy
 * stays put and only the body swaps, so the card does not change height when
 * the fetch lands.
 */
export const Loading: Story = {
  args: { rows: [], isLoading: true },
};

/**
 * A companion with no passport history and nothing captured yet. A plain muted
 * line rather than an illustrated empty state - this is a section inside a step,
 * not a route, so it presents like the other workspace sections.
 */
export const Empty: Story = {
  args: { rows: [] },
};

/** Records captured in this visit only - every row still awaiting attestation. */
export const AllDrafts: Story = {
  args: { rows: [draftVaccination, draftExam] },
};

/** An established passport: everything already attested, nothing new this visit. */
export const AllSigned: Story = {
  args: { rows: [signedRabies, signedTitration, signedTreatment] },
};

/**
 * All four record kinds together, including the "Not fit for travel" exam whose
 * title is the only place a negative outcome appears. This is the view that
 * makes a kind-label or row-rhythm regression obvious.
 */
export const EveryRecordKind: Story = {
  args: {
    rows: [draftVaccination, draftExam, signedTitration, signedTreatment, signedNotFit],
  },
};

/**
 * The passport fetch failed. The message is the server's own wording where it
 * sent one, and it sits above the body rather than replacing it.
 */
export const LoadFailed: Story = {
  args: {
    rows: [],
    loadError: 'Unable to load the passport for this companion.',
  },
};

/**
 * A failure after rows were already captured in this visit. The drafts must
 * survive the error - they exist on the encounter regardless of whether the
 * assembled passport could be re-read.
 */
export const LoadFailedWithDrafts: Story = {
  args: {
    rows: [draftVaccination, draftExam],
    loadError: 'Invalid request body',
  },
};
