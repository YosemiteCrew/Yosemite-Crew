import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { SoapCodedProblems } from '@yosemite-crew/types';
import type { ClinicalTermSuggestion } from '@/app/features/appointments/services/clinicalTermsService';

import NativeSoapFields from './NativeSoapFields';

/** The four `SectionContainer` headings, in the order the component stacks them. */
const SECTION_TITLES = [
  'Subjective (History)',
  'Objective (Examination)',
  'Assessment (Differential)',
  'Plan',
] as const;

/** Every editor's `ariaLabel`, which is also its accessible name as a textbox. */
const EDITOR_LABELS = [
  'Subjective history',
  'Objective examination',
  'Assessment differential',
  'Plan',
] as const;

/**
 * The vocabulary bucket each section's picker is supposed to narrow to, and the
 * deliberate hole: Objective spans exam findings AND tests, so it searches every
 * domain and sends no `domain` param at all.
 */
const SECTION_DOMAINS: Array<[string, string | null]> = [
  ['Subjective', 'PresentingComplaint'],
  ['Objective', null],
  ['Assessment', 'Diagnosis'],
  ['Plan', 'Procedure'],
];

const PROSE = {
  subjective:
    '<p>Owner reports intermittent left forelimb lameness since Sunday, worse after exercise.</p>',
  objective: '<p>BAR. T 38.6, HR 96, RR 24. Pain on carpal extension, no effusion.</p>',
  assessment: '<p>Suspected soft-tissue strain. Differentials: OA, fragmented coronoid.</p>',
  plan: '<p>Rest 10 days, NSAID course, recheck Friday. Radiographs if no improvement.</p>',
};

const PINNED: SoapCodedProblems = {
  subjective: [{ ycCode: 'YC-000912', label: 'Lameness', domain: 'PresentingComplaint' }],
  assessment: [{ ycCode: 'YC-005416', label: 'Gastroenteritis', domain: 'Diagnosis' }],
  plan: [{ ycCode: 'YC-002210', label: 'Radiography', domain: 'Procedure' }],
};

const RADIOGRAPHY: ClinicalTermSuggestion = {
  ycCode: 'YC-002210',
  label: 'Radiography',
  domain: 'Procedure',
  species: ['Canine', 'Feline'],
  synonyms: ['X-ray', 'radiografía'],
};

/* ------------------------------------------------------------------ *
 * Stubbing the vocabulary service
 *
 * Four `SoapCodedTermPicker`s mount here, so the terminology endpoint is hit
 * four separate ways and the stub is not optional - without it these stories
 * would fire real suggest calls at the dev API. `suggestClinicalTerms` is an ESM
 * export and cannot be reassigned, and it reaches the API through the shared
 * axios instance's XHR adapter, so the seam is `XMLHttpRequest.prototype` - the
 * same one SoapCodedTermPicker.stories.tsx uses. Everything that is not the
 * suggest endpoint is handed to the real transport untouched.
 * ------------------------------------------------------------------ */

const SUGGEST_PATH = '/codes/terms/suggest';
const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

type StubbedXhr = XMLHttpRequest & { storyUrl?: string };

/** Every suggest URL asked for during the current story, in order. */
const suggestRequests: string[] = [];

const answerWith = (xhr: XMLHttpRequest, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  // Own data properties shadow the prototype's accessors - the only way to hand
  // axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: status, configurable: true });
  Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: text, configurable: true });
  // axios listens on `onloadend`; dispatching the event runs that handler.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const withSuggestions =
  (items: ClinicalTermSuggestion[] = []) =>
  () => {
    suggestRequests.length = 0;

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
      if (!this.storyUrl?.includes(SUGGEST_PATH)) {
        REAL_XHR_SEND.call(this, body ?? null);
        return;
      }
      suggestRequests.push(this.storyUrl);
      // Answered on a later tick so the picker's debounce and request-sequence
      // guard are exercised rather than short-circuited.
      setTimeout(() => answerWith(this, 200, { items }), 0);
    };

    /* Restored to the module-level originals rather than to whatever was installed
     before, so a meta-level and a story-level stub cannot strand one another
     whichever order their cleanups run in. */
    return () => {
      XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
      XMLHttpRequest.prototype.send = REAL_XHR_SEND;
    };
  };

/**
 * The VISIBLE section heading, with the screen-reader layer filtered out.
 *
 * "Plan" is in this tree twice and both copies are correct: `SectionContainer`
 * draws the heading, and the `RichTextEditor` inside it renders its `ariaLabel`
 * as an `sr-only` span. For three sections those two strings differ; for Plan
 * they are the same word, so a bare `getByText('Plan')` throws "Found multiple
 * elements". `.sr-only` also excludes the preview decorator's story-title
 * banner. `script, style` is restated because `ignore` REPLACES the default
 * rather than adding to it.
 */
const sectionTitle = (canvas: ReturnType<typeof within>, title: string) =>
  canvas.getByText(title, { ignore: 'script, style, .sr-only' });

/** The `SectionContainer` card a node sits in - the rounded, bordered box. */
const cardOf = (node: HTMLElement) => node.closest('.rounded-2xl') as HTMLElement;

const searchField = (canvas: ReturnType<typeof within>, sectionLabel: string) =>
  canvas.getByRole('searchbox', { name: `Add coded term to ${sectionLabel}` });

/** The portalled results panel, matched as the fixed-position direct child of <body>. */
const resultsPanel = (canvasElement: HTMLElement): HTMLElement | null =>
  canvasElement.ownerDocument.body.querySelector<HTMLElement>(
    ':scope > div[style*="position: fixed"]'
  );

const meta = {
  title: 'Workspace/NativeSoapFields',
  component: NativeSoapFields,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The four native SOAP sections: a rich-text editor per section, a coded-term picker ' +
          'under each one, and the Record Vitals action docked to Objective.\n\n' +
          '**The four pickers are not interchangeable.** Each is handed a different vocabulary ' +
          'domain - Subjective searches `PresentingComplaint`, Assessment `Diagnosis`, Plan ' +
          '`Procedure` - and Objective is handed none on purpose, because exam findings and ' +
          'tests live in different buckets so it has to search all of them. Nothing on screen ' +
          'says which bucket a picker is querying: get the mapping wrong and the dropdown still ' +
          'fills, just with terms from the wrong vocabulary. `SectionDomains` below reads the ' +
          'domain off the request URL for exactly that reason.\n\n' +
          '**Only Subjective is translated.** `terminologyText` is applied to the subjective ' +
          'placeholder and to nothing else - the other three placeholders are literals in the ' +
          'component - so an organisation that calls its animals "animals" still reads ' +
          '"Examination findings and recorded vitals" underneath.\n\n' +
          'The vocabulary endpoint is answered from an `XMLHttpRequest` stub, so no story here ' +
          'reaches the terminology service.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    terminologyText: (text: string) => text,
    onSubjectiveChange: fn(),
    onObjectiveChange: fn(),
    onAssessmentChange: fn(),
    onPlanChange: fn(),
    onCodedProblemsChange: fn(),
    onRecordVitals: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex max-w-[820px] flex-col gap-5">
        <Story />
      </div>
    ),
  ],
  beforeEach: withSuggestions(),
} satisfies Meta<typeof NativeSoapFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'All four sections empty',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const title of SECTION_TITLES) {
      await expect(sectionTitle(canvas, title)).toBeInTheDocument();
    }

    /* Each editor arrives after mount (`immediatelyRender: false`), so the first
       one is awaited before the rest are read synchronously. The accessible name
       is the ONLY thing telling the four apart on a screen reader - they are
       otherwise four identical unlabelled boxes. */
    await canvas.findByRole('textbox', { name: EDITOR_LABELS[0] });
    for (const label of EDITOR_LABELS) {
      await expect(canvas.getByRole('textbox', { name: label })).toBeInTheDocument();
    }

    // The placeholder only paints while the value is empty, and it is
    // `aria-hidden` - real prose, not a `placeholder` attribute a screen reader
    // would announce over the editor's own name.
    const placeholder = canvas.getByText('Patient history and owner-reported information');
    await expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.getByText('Examination findings and recorded vitals')).toBeInTheDocument();
    await expect(canvas.getByText('Diagnosis and differentials')).toBeInTheDocument();
    await expect(canvas.getByText('Treatment plan and next steps')).toBeInTheDocument();

    /* One picker per section, each named for its section. Four fields called
       "Search" would be unusable, and the section name is also what the pick
       handler keys on below. */
    for (const [sectionLabel] of SECTION_DOMAINS) {
      await expect(searchField(canvas, sectionLabel)).toBeInTheDocument();
    }

    // Nothing pinned means no chip list at all rather than four empty <ul>s.
    await expect(canvas.queryByRole('list')).toBeNull();
  },
};

export const Prefilled: Story = {
  name: 'Prose in every section',
  args: PROSE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const subjective = await canvas.findByRole('textbox', { name: 'Subjective history' });

    /* Content lands in the editor it was handed to. Four editors take four
       separate props through four separate `RichTextEditor` instances, and a
       crossed pair renders perfectly - it just puts the history in the plan. */
    await expect(subjective).toHaveTextContent(/intermittent left forelimb lameness/);
    await expect(canvas.getByRole('textbox', { name: 'Objective examination' })).toHaveTextContent(
      /Pain on carpal extension/
    );
    await expect(
      canvas.getByRole('textbox', { name: 'Assessment differential' })
    ).toHaveTextContent(/Suspected soft-tissue strain/);
    await expect(canvas.getByRole('textbox', { name: 'Plan' })).toHaveTextContent(
      /Rest 10 days, NSAID course/
    );

    // `isRichTextEmpty` strips tags before deciding, so a populated section drops
    // its placeholder entirely instead of drawing it under the first line.
    await expect(canvas.queryByText('Patient history and owner-reported information')).toBeNull();
    await expect(canvas.queryByText('Treatment plan and next steps')).toBeNull();
  },
};

export const CodedTermsPinned: Story = {
  name: 'Terms pinned to three of the four sections',
  args: { ...PROSE, codedProblems: PINNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Subjective history' });

    /* `codedProblems?.[section] ?? []` is the whole of the per-section split, so
       a chip has to land under its own section and nowhere else. Scoped by the
       list's accessible name rather than by document-wide text: all four chip
       lists look identical, and a mapping that put every term in every section
       would satisfy a bare `getByText`. */
    const assessment = within(canvas.getByRole('list', { name: 'Assessment coded terms' }));
    await expect(assessment.getAllByRole('listitem')).toHaveLength(1);
    await expect(assessment.getByText('Gastroenteritis')).toBeInTheDocument();
    // The code rides beside the label: it is what is actually stored on the note.
    await expect(assessment.getByText('YC-005416')).toBeInTheDocument();

    const subjective = within(canvas.getByRole('list', { name: 'Subjective coded terms' }));
    await expect(subjective.getByText('Lameness')).toBeInTheDocument();
    await expect(subjective.queryByText('Gastroenteritis')).toBeNull();

    const plan = within(canvas.getByRole('list', { name: 'Plan coded terms' }));
    await expect(plan.getByText('Radiography')).toBeInTheDocument();

    // Objective was given nothing, so it renders no list - three lists, not four.
    await expect(canvas.getAllByRole('list')).toHaveLength(3);
    await expect(canvas.queryByRole('list', { name: 'Objective coded terms' })).toBeNull();
  },
};

export const SectionDomains: Story = {
  name: 'Each section searches its own vocabulary',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Subjective history' });

    /* One picker at a time, each awaited before the next: the requests are
       matched to sections by their position in this array, so overlapping
       250ms debounces would make the assertion below meaningless. */
    for (const [index, [sectionLabel]] of SECTION_DOMAINS.entries()) {
      await userEvent.type(searchField(canvas, sectionLabel), 'rad');
      await waitFor(() => expect(suggestRequests).toHaveLength(index + 1), { timeout: 3000 });
    }

    for (const [index, [, domain]] of SECTION_DOMAINS.entries()) {
      const requested = suggestRequests[index];
      await expect(requested).toContain('q=rad');
      if (domain) {
        await expect(requested).toContain(`domain=${domain}`);
      } else {
        /* Objective deliberately sends NO domain. A default slipped in here
           would quietly hide half its vocabulary - exam findings and diagnostic
           tests sit in different buckets - and the picker would still look like
           it was working. */
        await expect(requested).not.toContain('domain=');
      }
    }
  },
};

export const PicksIntoItsOwnSection: Story = {
  name: 'A picked term reports the section it came from',
  beforeEach: withSuggestions([RADIOGRAPHY]),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Subjective history' });

    await userEvent.type(searchField(canvas, 'Plan'), 'rad');
    await waitFor(() => expect(resultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });

    // The dropdown is a fixed-position portal on <body>, outside canvasElement.
    const panel = resultsPanel(canvasElement) as HTMLElement;
    await userEvent.click(within(panel).getByRole('button', { name: /^Radiography YC-002210/ }));

    /* The section key is bound per picker in a loop over four near-identical
       calls, so the failure this guards against is a term picked in Plan being
       written onto Assessment. Nothing on screen would show it: the parent owns
       `codedProblems`, so the chip appears under whichever section the parent
       hands it back to. */
    await expect(args.onCodedProblemsChange).toHaveBeenCalledTimes(1);
    await expect(args.onCodedProblemsChange).toHaveBeenCalledWith('plan', [
      { ycCode: 'YC-002210', label: 'Radiography', domain: 'Procedure' },
    ]);

    // `species` and `synonyms` are search metadata and must not ride onto the
    // note with the term - only code, label and domain are stored.
    const [, terms] = args.onCodedProblemsChange.mock.calls[0];
    await expect(Object.keys(terms[0]).sort()).toEqual(['domain', 'label', 'ycCode']);
  },
};

export const RecordVitals: Story = {
  name: 'Record Vitals belongs to Objective',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Objective examination' });

    const button = canvas.getByRole('button', { name: 'Record Vitals' });

    /* Exactly one, and it is inside the Objective card. Vitals ARE the objective
       section, so this action drifting into Subjective or Plan would read as a
       different workflow while every text assertion still passed. */
    await expect(canvas.getAllByRole('button', { name: 'Record Vitals' })).toHaveLength(1);
    const objectiveCard = cardOf(sectionTitle(canvas, 'Objective (Examination)'));
    await expect(objectiveCard.contains(button)).toBe(true);

    // `justify-end`: the action hugs the right edge of its own card rather than
    // floating under the editor.
    const row = button.parentElement as HTMLElement;
    await expect(Math.round(button.getBoundingClientRect().right)).toBe(
      Math.round(row.getBoundingClientRect().right)
    );

    await userEvent.click(button);
    await expect(args.onRecordVitals).toHaveBeenCalledTimes(1);

    /* It opens the vitals capture and nothing else. The button sits inside the
       Objective card between the editor and that section's picker, so the
       neighbouring handler is the one it could plausibly be crossed with.

       Note what is NOT asserted here: `onObjectiveChange`. Every editor emits
       one change on mount before anyone types - Tiptap normalises the empty
       document and the sanitised HTML is reported back - so a "no edit
       happened" assertion against the editor handlers is already false on the
       first paint. Worth knowing before writing a dirty-tracking check against
       this component. */
    await expect(args.onCodedProblemsChange).not.toHaveBeenCalled();
  },
};

export const TerminologyOverride: Story = {
  name: 'Terminology rewrites the subjective placeholder only',
  args: {
    terminologyText: (text: string) => text.replaceAll(/\bPatient\b/g, 'Animal'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Subjective history' });

    // Subjective is the one placeholder routed through `terminologyText`.
    await expect(
      canvas.getByText('Animal history and owner-reported information')
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Patient history and owner-reported information')).toBeNull();

    /* The other three are literals in the component and do NOT track the org's
       term. Pinned deliberately: it is the current behaviour, it is invisible
       until someone reads all four placeholders side by side, and if the other
       three are ever routed through the same function this assertion is what
       says so. */
    await expect(canvas.getByText('Examination findings and recorded vitals')).toBeInTheDocument();
    await expect(canvas.getByText('Diagnosis and differentials')).toBeInTheDocument();
    await expect(canvas.getByText('Treatment plan and next steps')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* Width pinned here as well as through the viewport global. The global is
     applied by the Storybook MANAGER, so a runner loading `iframe.html` directly
     renders this at panel width - where the overflow check below is true for the
     wrong reason. */
  decorators: [
    (Story) => (
      <div className="flex w-[375px] flex-col gap-5 p-3">
        <Story />
      </div>
    ),
  ],
  args: { ...PROSE, codedProblems: PINNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: 'Subjective history' });

    /* Below `sm` the picker's search field loses its 360px cap and goes full
       width. Its own card is what has to contain it - a field wider than the
       card is the failure that puts a horizontal scrollbar on the whole step. */
    const field = searchField(canvas, 'Assessment');
    const card = cardOf(field);
    await expect(Math.ceil(field.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.ceil(card.getBoundingClientRect().right)
    );

    // Chips wrap rather than pushing the card wide: a two-word term and its code
    // sit on one pill, and the pill row is `flex-wrap`.
    const chips = canvas.getByRole('list', { name: 'Plan coded terms' });
    await expect(Math.ceil(chips.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.ceil(card.getBoundingClientRect().right)
    );

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
