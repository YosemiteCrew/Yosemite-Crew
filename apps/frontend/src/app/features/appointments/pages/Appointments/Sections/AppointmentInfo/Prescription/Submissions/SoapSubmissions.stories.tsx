import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  createEmptyFormData,
  type FormDataProps,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import type { SoapNoteSubmission } from '@/app/features/appointments/types/soap';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';

import SoapSubmissions from './SoapSubmissions';

const TITLE = 'Previous assessment submissions';
const ORG_ID = 'org-storybook';
const ASSESSMENT_FORM_ID = 'form-soap-assessment';
const CONSENT_FORM_ID = 'form-sedation-consent';

/**
 * The forms these submissions were captured against. The submission carries the
 * answers keyed by field id and nothing else, so it is the STORE copy of the form
 * that decides whether `presenting_complaint` renders as "Presenting complaint" or
 * falls back to a humanised key - and whether the card gets a signature block at
 * all. Seeding the store is therefore not scaffolding, it is half the surface.
 */
const ASSESSMENT_FORM: FormsProps = {
  _id: ASSESSMENT_FORM_ID,
  orgId: ORG_ID,
  name: 'SOAP assessment',
  category: 'SOAP',
  usage: 'Internal',
  requiredSigner: 'VET',
  updatedBy: 'Dr. Weber',
  lastUpdated: '2026-05-04T09:00:00.000Z',
  status: 'Published',
  schema: [
    { id: 'presenting_complaint', type: 'input', label: 'Presenting complaint' },
    { id: 'clinical_findings', type: 'textarea', label: 'Clinical findings' },
    { id: 'vet_signature', type: 'signature', label: 'Veterinarian signature' },
  ],
};

const CONSENT_FORM: FormsProps = {
  _id: CONSENT_FORM_ID,
  orgId: ORG_ID,
  name: 'Sedation consent',
  category: 'Consent form',
  usage: 'External',
  requiredSigner: 'CLIENT',
  updatedBy: 'Dr. Weber',
  lastUpdated: '2026-05-02T08:30:00.000Z',
  status: 'Published',
  schema: [{ id: 'owner_consent', type: 'textarea', label: 'Consent statement' }],
};

const submission = (over: Partial<SoapNoteSubmission> & { _id: string }): SoapNoteSubmission => ({
  formId: ASSESSMENT_FORM_ID,
  formVersion: 1,
  appointmentId: 'appt-storybook-1',
  answers: {},
  submittedAt: new Date('2026-05-04T10:12:00.000Z'),
  ...over,
});

/**
 * Three cards, deliberately not three of the same card: one vet form still waiting
 * for a signature, the same form already signed, and a client form that the vet can
 * only watch. Each takes a different branch through the card body.
 */
const MIXED: SoapNoteSubmission[] = [
  submission({
    _id: 'sub-unsigned',
    answers: {
      presenting_complaint: 'Limping on the left hind leg for three days.',
      clinical_findings: 'Mild swelling over the stifle, pain on extension.',
      // Deliberately NOT in the schema: the label falls back to humanizeKey, so
      // an answer whose field was renamed or removed still renders readably
      // instead of showing a raw key or vanishing.
      followUpNotes: 'Recheck in ten days.',
    },
  }),
  submission({
    _id: 'sub-signed',
    submittedAt: new Date('2026-05-03T15:40:00.000Z'),
    answers: {
      presenting_complaint: 'Post-operative check after cruciate repair.',
      clinical_findings: 'Incision clean and dry, full weight bearing.',
    },
    signing: {
      required: true,
      provider: 'DOCUMENSO',
      status: 'SIGNED',
      pdf: { url: 'https://example.invalid/signed-assessment.pdf' },
    },
  }),
  submission({
    _id: 'sub-consent-pending',
    formId: CONSENT_FORM_ID,
    answers: { owner_consent: 'I consent to sedation for the dental examination.' },
  }),
];

const CLIENT_ONLY: SoapNoteSubmission[] = [
  submission({
    _id: 'sub-consent-pending',
    formId: CONSENT_FORM_ID,
    answers: { owner_consent: 'I consent to sedation for the dental examination.' },
  }),
  submission({
    _id: 'sub-consent-signed',
    formId: CONSENT_FORM_ID,
    answers: { owner_consent: 'I consent to the pre-anaesthetic blood panel.' },
    signing: {
      required: true,
      provider: 'DOCUMENSO',
      status: 'SIGNED',
      pdf: { url: 'https://example.invalid/signed-consent.pdf' },
    },
  }),
];

/**
 * `setFormData` is only reached when SignatureActions gets a signed URL back from
 * the network, which no story does, so a spy is enough and the panel stays a pure
 * function of its props - no component state to survive a story switch.
 */
const setFormData = fn();

/**
 * SoapSubmissions is generic over the SOAP key and takes the whole `formData`
 * bag plus its dispatch. This pins the key to `assessment` so the stories can pass
 * a plain list, and nothing else - the component under review is the real one.
 */
const SubmissionsPanel = ({ submissions }: { submissions: SoapNoteSubmission[] }) => {
  const formData: FormDataProps = { ...createEmptyFormData(), assessment: submissions };
  return (
    <SoapSubmissions
      formData={formData}
      setFormData={setFormData}
      formDataKey="assessment"
      title={TITLE}
    />
  );
};

const seedForms = () => {
  const snapshot = useFormsStore.getState();
  useFormsStore.setState({
    formsById: { [ASSESSMENT_FORM_ID]: ASSESSMENT_FORM, [CONSENT_FORM_ID]: CONSENT_FORM },
    formIds: [ASSESSMENT_FORM_ID, CONSENT_FORM_ID],
  });
  return () => {
    useFormsStore.setState(snapshot);
  };
};

/** Every card in the open body, so a selector change here fails loudly in one place. */
const cardsIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('div.border.rounded-xl.p-4'));

/** The accordion body. Absent, not hidden, while the accordion is closed. */
const bodyIn = (root: HTMLElement) => root.querySelector<HTMLElement>('div.border-x.border-b');

/**
 * Resolves a design token to the same `rgb()` string `getComputedStyle` reports
 * for a painted element, so the colour assertion compares like with like instead
 * of a hex literal against a computed rgb triple.
 *
 * The probe is created and removed HERE, never inside a `waitFor` callback:
 * testing-library retries through a MutationObserver, so a callback that mutates
 * the DOM and then throws re-queues itself forever and hangs the tab instead of
 * failing.
 */
const resolveTokenColor = (token: string): string => {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const meta = {
  title: 'Appointments/SoapSubmissions',
  component: SubmissionsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The history list under each SOAP section: what has already been submitted against this ' +
          'appointment. It is an `Accordion` with `defaultOpen={false}`, so **everything below is ' +
          'behind one click** and none of it had ever been drawn - not the cards, not the label ' +
          'resolution, not the signature block.\n\n' +
          'A submission stores answers keyed by field id and nothing else. The question text comes ' +
          'from the form in `formsStore` at render time, and when the key is missing from the ' +
          'schema (renamed field, deleted field, an answer written by an older version) it falls ' +
          'back to a humanised key rather than showing `follow_up_notes` or dropping the row. Both ' +
          'paths are in the open story, side by side in one card.\n\n' +
          'Which controls a card gets is derived from the FORM, not the submission: ' +
          '`requiredSigner: VET` plus either a signature field or existing signing data gets the ' +
          'Sign/View block; `requiredSigner: CLIENT` gets a read-only status line, because the vet ' +
          'cannot sign for the pet parent. Seeding two forms is what makes that split ' +
          'visible - with one form the two branches look like one branch.\n\n' +
          'A card with no string answers, no signature block and no parent line renders nothing at ' +
          'all, which is why the empty story asserts a card count of zero rather than trusting the ' +
          '"No submissions yet." sentence: a filter bug would print that same sentence.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    submissions: MIXED,
  },
  beforeEach: seedForms,
} satisfies Meta<typeof SubmissionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed (as it mounts)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: TITLE });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    /* The header carries the title as real text, not only as the aria-label the
       query above matched - those are two different strings in Accordion and a
       blank span would still satisfy a role query. */
    await expect(toggle).toHaveTextContent(TITLE);

    /* Collapsed is not "hidden": Accordion renders no children at all while
       closed, so the body element itself is absent from the DOM rather than
       display:none. Nothing below the header can be reviewed, or snapshotted,
       until it opens - which is the whole argument for these stories. */
    await expect(bodyIn(canvasElement)).toBeNull();
    await expect(cardsIn(canvasElement)).toHaveLength(0);
    await expect(canvas.queryByText('Presenting complaint')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Sign' })).not.toBeInTheDocument();
    // Exactly one control in the whole collapsed section: the toggle.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'How every SOAP section actually mounts. The header carries the count of nothing - there ' +
          'is no badge - so the only way to learn whether this appointment has submissions is to ' +
          'open it.',
      },
    },
  },
};

export const Expanded: Story = {
  name: 'Open: three submission cards',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: TITLE });

    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const cards = cardsIn(canvasElement);
    await expect(cards).toHaveLength(3);

    /* Three answers in, three question/answer rows out. Answers are filtered to
       string values only, so a numeric or array answer silently drops its row -
       counting the rows catches that, reading one label does not. The row is the
       only `gap-1` block in the card; the answers block and the signature block
       are both `flex flex-col gap-2` and cannot be told apart by class. */
    const [firstCard] = cards;
    await expect(firstCard.querySelectorAll('div.flex.flex-col.gap-1')).toHaveLength(3);

    /* Labels are per-CARD, and two of the three cards were captured against the
       same assessment form, so "Presenting complaint" and "Clinical findings"
       each render TWICE in this body - once per card. That is the list working:
       every submission repeats the question text above its own answer, there is
       no shared header row. So label queries have to be scoped to a card, and an
       unscoped `getByText` throws "Found multiple elements" rather than telling
       you which card it found. Pinned as a count first, so the scoping below
       reads as a consequence of the data rather than as defensive noise. */
    const openBody = bodyIn(canvasElement) as HTMLElement;
    await expect(within(openBody).getAllByText('Presenting complaint')).toHaveLength(2);
    await expect(within(openBody).getAllByText('Clinical findings')).toHaveLength(2);

    // Resolved from the seeded schema, in the first card...
    const firstCardQueries = within(firstCard);
    await expect(firstCardQueries.getByText('Presenting complaint')).toBeInTheDocument();
    await expect(firstCardQueries.getByText('Clinical findings')).toBeInTheDocument();
    await expect(
      firstCardQueries.getByText('Limping on the left hind leg for three days.')
    ).toBeInTheDocument();
    // ...and this one is not in the schema, so it is humanised rather than raw.
    // Unique across the body: only the first submission carries the stray key.
    await expect(canvas.getByText('Follow Up Notes')).toBeInTheDocument();

    // The vet form gets exactly one Sign (unsigned card) and one View (signed card).
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'View' })).toBeInTheDocument();

    // The client form gets neither - only a status line.
    await expect(
      canvas.getByText('Sent to pet parent. It will update when they sign the document.')
    ).toBeInTheDocument();

    /* Signed is the only status painted in --success-text; everything else uses
       --ink-muted via text-text-secondary. Asserting the resolved token value
       rather than "the two differ" is what catches the failure mode this repo
       keeps hitting: an arbitrary-value utility whose token does not resolve
       emits no colour at all, so the label silently inherits body ink and still
       looks like a deliberate choice. Read inside waitFor - these rows sit under
       `transition-colors`, and a single synchronous read can catch an
       interpolated value mid-transition. */
    const successInk = resolveTokenColor('--success-text');
    const required = canvas.getByText('Signature required');
    const signed = canvas.getByText('Signed');
    await waitFor(() => {
      expect(getComputedStyle(signed).color).toBe(successInk);
    });
    await expect(getComputedStyle(required).color).not.toBe(successInk);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the section is in for most of a visit. Worth looking at: the first card mixes ' +
          'two schema-resolved questions with one that is not in the schema any more, and the ' +
          'three cards each end differently - a Sign button, a View button, and a sentence with no ' +
          'control at all.\n\n' +
          'Question text is repeated inside every card rather than hoisted into a header, so two ' +
          'submissions against the same form put the same label on screen twice. Any query for a ' +
          'label here has to name the card it belongs to.',
      },
    },
  },
};

export const NoSubmissions: Story = {
  name: 'Open: nothing submitted yet',
  args: { submissions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: TITLE }));

    /* The sentence alone proves nothing: a card that renders no rows would leave
       this list looking empty too, and a submission whose answers are all
       non-string returns null from the map, printing this same sentence's
       neighbourhood. Assert the shape of the body, not just its wording. */
    const body = bodyIn(canvasElement);
    await expect(body).not.toBeNull();
    await expect(body?.children).toHaveLength(1);
    await expect(body?.firstElementChild).toHaveTextContent('No submissions yet.');
    await expect(cardsIn(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty branch returns a different tree, not an empty version of the same one - one ' +
          'muted sentence at 60% ink, no card frame around it.',
      },
    },
  },
};

export const ClientSignedAndPending: Story = {
  name: 'Open: parent-signed forms only',
  args: { submissions: CLIENT_ONLY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: TITLE }));

    const cards = cardsIn(canvasElement);
    await expect(cards).toHaveLength(2);
    /* One answer row per card, so the consent text is drawn above the status
       line rather than the card collapsing to a bare status. */
    await expect(
      cards.map((card) => card.querySelectorAll('div.flex.flex-col.gap-1').length)
    ).toEqual([1, 1]);
    await expect(cards[0]).toHaveTextContent(
      'Sent to pet parent. It will update when they sign the document.'
    );
    await expect(cards[1]).toHaveTextContent('Signed by pet parent.');
    await expect(
      canvas.getByText('I consent to sedation for the dental examination.')
    ).toBeInTheDocument();

    /* The whole point of the CLIENT branch: no Sign button exists for the vet,
       even on the card that is still unsigned. Sign is gated on the form's
       requiredSigner, not on whether a signature is outstanding. */
    await expect(canvas.queryByRole('button', { name: 'Sign' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the consent forms look like from the clinic side. The signed line is derived from ' +
          '`signing.status === SIGNED` OR the presence of a signed PDF url, so a submission that ' +
          'has the document but not the status still reads as signed.',
      },
    },
  },
};
