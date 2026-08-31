import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { SoapCodedTerm } from '@yosemite-crew/types';
import type { ClinicalTermSuggestion } from '@/app/features/appointments/services/clinicalTermsService';

import SoapCodedTermPicker from './SoapCodedTermPicker';

const GASTROENTERITIS: ClinicalTermSuggestion = {
  ycCode: 'YC-005416',
  label: 'Gastroenteritis',
  domain: 'Diagnosis',
  species: ['Canine', 'Feline'],
  synonyms: ['Gastro-enteritis', 'gastroenteritis aguda'],
};

const GDV: ClinicalTermSuggestion = {
  ycCode: 'YC-005417',
  label: 'Gastric dilatation-volvulus',
  domain: 'Diagnosis',
  species: ['Canine'],
  synonyms: ['GDV', 'bloat'],
};

/** Its label carries no "anomal", so a hit on this one can only be a synonym hit. */
const BEHAVIOURAL: ClinicalTermSuggestion = {
  ycCode: 'YC-004120',
  label: 'Behavioural abnormality',
  domain: 'Diagnosis',
  species: ['Canine', 'Feline'],
  synonyms: ['anomalía del comportamiento', 'Verhaltensauffälligkeit'],
};

const PINNED: SoapCodedTerm[] = [
  { ycCode: 'YC-005416', label: 'Gastroenteritis', domain: 'Diagnosis' },
  { ycCode: 'YC-004120', label: 'Behavioural abnormality', domain: 'Diagnosis' },
];

/* ------------------------------------------------------------------ *
 * Stubbing the vocabulary service
 *
 * `suggestClinicalTerms` is an ESM export, so it cannot be reassigned from a
 * story. It reaches the API through the shared axios instance, which uses the
 * XHR adapter in the browser - so the seam is `XMLHttpRequest.prototype`, the
 * same one ChangeRoom.stories.tsx uses. Only the suggest endpoint is answered;
 * anything else is handed to the real transport untouched.
 * ------------------------------------------------------------------ */

const SUGGEST_PATH = '/codes/terms/suggest';
const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

type StubbedXhr = XMLHttpRequest & { storyUrl?: string };

/** Every suggest URL the picker asked for, in order, for the current story. */
const suggestRequests: string[] = [];

const answerWith = (xhr: XMLHttpRequest, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  // Own data properties shadow the prototype's accessors, which is the only way
  // to hand axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: status, configurable: true });
  Object.defineProperty(xhr, 'statusText', {
    value: status === 200 ? 'OK' : 'Not Found',
    configurable: true,
  });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: text, configurable: true });
  // axios listens on `onloadend`; dispatching the event runs that handler.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const withSuggestions = (reply: { status?: number; items?: ClinicalTermSuggestion[] }) => () => {
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
    // Answered on a later tick, so the debounce and the request-sequence guard
    // are exercised rather than short-circuited.
    setTimeout(() => answerWith(this, reply.status ?? 200, { items: reply.items ?? [] }), 0);
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
 * The dropdown renders through a portal onto <body>, outside `canvasElement`,
 * so every result query has to start from the document rather than the canvas.
 * It is matched as the fixed-position direct child of <body> - Storybook keeps
 * its own hidden wrappers there (one of which holds an unlabelled <ul>), so a
 * looser selector silently matches those and every result assertion then runs
 * against the wrong element while still finding "a list".
 */
const openResultsPanel = (canvasElement: HTMLElement): HTMLElement | null =>
  canvasElement.ownerDocument.body.querySelector<HTMLElement>(
    ':scope > div[style*="position: fixed"]'
  );

const resultsPanel = (canvasElement: HTMLElement): HTMLElement => {
  const panel = openResultsPanel(canvasElement);
  if (!panel) throw new Error('results dropdown is not open');
  return panel;
};

const searchField = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('searchbox', { name: 'Add coded term to Assessment' });

/**
 * `selected` is owned by the SOAP note in the app, so the interaction stories
 * hold it here and forward every change to the spy as well - otherwise adding a
 * chip would call `onChange` and then render the unchanged prop back.
 */
const ControlledPicker = (args: React.ComponentProps<typeof SoapCodedTermPicker>) => {
  const [selected, setSelected] = useState<SoapCodedTerm[]>(args.selected);
  return (
    <SoapCodedTermPicker
      {...args}
      selected={selected}
      onChange={(terms) => {
        setSelected(terms);
        args.onChange(terms);
      }}
    />
  );
};

const meta = {
  title: 'Workspace/SoapCodedTermPicker',
  component: SoapCodedTermPicker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Coded-term chips for one SOAP section. Typing two or more characters searches the clinical ' +
          'vocabulary after a 250ms debounce; picking a suggestion pins it as a chip carrying the ' +
          'label and the YC code. The suggest call matches multilingual synonyms as well as display ' +
          'text, so a hit whose label does not contain the query says which synonym matched instead ' +
          'of appearing to be a random result. The stories answer the vocabulary endpoint from a ' +
          'stub rather than the live API.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    sectionLabel: 'Assessment',
    domain: 'Diagnosis',
    selected: [],
    onChange: fn(),
  },
  beforeEach: withSuggestions({ items: [] }),
} satisfies Meta<typeof SoapCodedTermPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Nothing picked yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The label names the section, because a SOAP note stacks four of these
       fields and "Search" four times over is unusable on a screen reader. */
    await expect(searchField(canvasElement)).toHaveAttribute('placeholder', 'Add coded term');
    // With nothing pinned the chip list is absent rather than an empty <ul>.
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(openResultsPanel(canvasElement)).toBeNull();
  },
};

export const WithChips: Story = {
  name: 'Two terms pinned',
  args: { selected: PINNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chips = canvas.getByRole('list', { name: 'Assessment coded terms' });
    await expect(within(chips).getAllByRole('listitem')).toHaveLength(2);

    /* The code rides beside the label on the chip: it is what actually gets
       stored on the note, so dropping it would leave the clinician unable to
       tell two similarly-named concepts apart. */
    await expect(within(chips).getByText('YC-005416')).toBeInTheDocument();
    await expect(within(chips).getByText('YC-004120')).toBeInTheDocument();

    // The remove control is an icon button, so its name has to be supplied.
    await expect(
      within(chips).getByRole('button', { name: 'Remove Gastroenteritis' })
    ).toBeInTheDocument();
  },
};

export const BelowMinimumQuery: Story = {
  name: 'A single character searches nothing',
  play: async ({ canvasElement }) => {
    await userEvent.type(searchField(canvasElement), 'g');
    // Long enough to cover the 250ms debounce if one had been scheduled.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    /* One character would match a large slice of the vocabulary, so the picker
       must not call at all - not call and then discard. A regression here is
       invisible in the UI and only shows up as load on the terminology service. */
    await expect(suggestRequests).toHaveLength(0);
    await expect(openResultsPanel(canvasElement)).toBeNull();
  },
};

export const Results: Story = {
  name: 'Matches, anchored to the field',
  beforeEach: withSuggestions({ items: [GASTROENTERITIS, GDV] }),
  play: async ({ canvasElement }) => {
    const input = searchField(canvasElement);
    await userEvent.type(input, 'gast');

    await waitFor(() => expect(openResultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });
    const panel = within(resultsPanel(canvasElement));
    await expect(panel.getByText('Gastroenteritis')).toBeInTheDocument();
    await expect(panel.getByText('Gastric dilatation-volvulus')).toBeInTheDocument();
    /* Both labels contain the query, so the origin line is the bare code with no
       "matches" clause bolted on. */
    await expect(panel.getByText('YC-005417')).toBeInTheDocument();

    /* The section's domain narrows the vocabulary bucket. If it stopped reaching
       the service the dropdown would still fill - with terms from the wrong
       bucket - which is the kind of wrong that never looks broken. */
    const [requested] = suggestRequests;
    await expect(requested).toContain('q=gast');
    await expect(requested).toContain('domain=Diagnosis');
    await expect(requested).toContain('limit=8');

    /* The panel is a fixed-position portal precisely so it escapes the workspace
       cards that used to clip it. That only works if it is still positioned on
       the field it belongs to: same left edge, same width, 4px under it. */
    const anchor = (input.closest('.relative') as HTMLElement).getBoundingClientRect();
    const dropdown = resultsPanel(canvasElement).getBoundingClientRect();
    await expect(Math.round(dropdown.left)).toBe(Math.round(anchor.left));
    await expect(Math.round(dropdown.width)).toBe(Math.round(anchor.width));
    await expect(Math.round(dropdown.top)).toBe(Math.round(anchor.bottom + 4));
  },
};

export const MatchedBySynonym: Story = {
  name: 'A hit the label does not explain',
  beforeEach: withSuggestions({ items: [BEHAVIOURAL] }),
  play: async ({ canvasElement }) => {
    await userEvent.type(searchField(canvasElement), 'anomal');

    await waitFor(() => expect(openResultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });
    const panel = within(resultsPanel(canvasElement));

    /* "anomal" appears nowhere in "Behavioural abnormality", so without the
       origin line the row looks like a bug. The curly quotes are the component's,
       not a typographic accident in this assertion. */
    await expect(
      panel.getByText('YC-004120 · matches “anomalía del comportamiento”')
    ).toBeInTheDocument();
  },
};

export const AlreadyAdded: Story = {
  name: 'A pinned term cannot be picked twice',
  args: { selected: [PINNED[0]] },
  beforeEach: withSuggestions({ items: [GASTROENTERITIS, GDV] }),
  play: async ({ canvasElement }) => {
    await userEvent.type(searchField(canvasElement), 'gast');

    await waitFor(() => expect(openResultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });
    const panel = within(resultsPanel(canvasElement));

    /* Disabled and labelled rather than filtered out: hiding it would read as
       "the vocabulary does not have it", which sends the clinician searching
       again for a term already sitting in the chips above. */
    const pinned = panel.getByRole('button', { name: /^Gastroenteritis YC-005416/ });
    await expect(pinned).toBeDisabled();
    await expect(pinned).toHaveAttribute('title', 'Added');
    await expect(within(pinned).getByText('Added')).toBeInTheDocument();

    // The neighbouring row is untouched, so the whole list is not disabled at once.
    await expect(panel.getByRole('button', { name: /^Gastric dilatation-volvulus/ })).toBeEnabled();
  },
};

export const AddsATerm: Story = {
  name: 'Picking a suggestion',
  beforeEach: withSuggestions({ items: [GASTROENTERITIS, GDV] }),
  render: (args) => <ControlledPicker {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = searchField(canvasElement);
    await userEvent.type(input, 'gast');

    await waitFor(() => expect(openResultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });
    await userEvent.click(
      within(resultsPanel(canvasElement)).getByRole('button', {
        name: /^Gastric dilatation-volvulus/,
      })
    );

    /* The chip carries the code, the display at pick time and the domain - the
       three fields the note stores. `species` and `synonyms` are search metadata
       and must not be dragged onto the note with it. */
    await expect(args.onChange).toHaveBeenCalledWith([
      { ycCode: 'YC-005417', label: 'Gastric dilatation-volvulus', domain: 'Diagnosis' },
    ]);

    // Picking clears the query, which in turn closes the dropdown - otherwise the
    // panel would sit over the note until the clinician clicked elsewhere.
    await waitFor(() => expect(openResultsPanel(canvasElement)).toBeNull(), { timeout: 3000 });
    await expect(input).toHaveValue('');
    await expect(
      canvas.getByRole('button', { name: 'Remove Gastric dilatation-volvulus' })
    ).toBeInTheDocument();
  },
};

export const RemovesAChip: Story = {
  name: 'Unpinning a term',
  args: { selected: PINNED },
  render: (args) => <ControlledPicker {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Gastroenteritis' }));

    // Removal is by code, so the survivor is the other term and not "everything
    // with a different label".
    await expect(args.onChange).toHaveBeenCalledWith([PINNED[1]]);
    await expect(canvas.queryByText('YC-005416')).toBeNull();
    await expect(canvas.getByText('YC-004120')).toBeInTheDocument();
  },
};

export const ServiceUnavailable: Story = {
  name: 'The vocabulary service refuses',
  beforeEach: withSuggestions({ status: 404 }),
  play: async ({ canvasElement }) => {
    await userEvent.type(searchField(canvasElement), 'gast');
    await waitFor(() => expect(suggestRequests).toHaveLength(1), { timeout: 3000 });

    /* A failed lookup clears the results instead of leaving the previous set on
       screen, so a stale dropdown can never be picked from after the vocabulary
       has gone away. Nothing else about the field changes - the clinician can
       still type prose into the section. */
    await expect(openResultsPanel(canvasElement)).toBeNull();
    await expect(searchField(canvasElement)).toHaveValue('gast');
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withSuggestions({ items: [GASTROENTERITIS, GDV] }),
  play: async ({ canvasElement }) => {
    const input = searchField(canvasElement);
    await userEvent.type(input, 'gast');
    await waitFor(() => expect(openResultsPanel(canvasElement)).not.toBeNull(), { timeout: 3000 });

    /* Below `sm` the field loses its 360px cap and goes full width, and the
       dropdown is sized from the field in JS rather than by CSS - so this is
       where a fixed-position panel would run off the right edge of the phone. */
    const dropdown = resultsPanel(canvasElement).getBoundingClientRect();
    const anchor = (input.closest('.relative') as HTMLElement).getBoundingClientRect();
    await expect(Math.round(dropdown.width)).toBe(Math.round(anchor.width));
    await expect(Math.ceil(dropdown.right)).toBeLessThanOrEqual(globalThis.window.innerWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
