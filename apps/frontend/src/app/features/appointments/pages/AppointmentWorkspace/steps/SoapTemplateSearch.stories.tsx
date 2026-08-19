import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SoapTemplateSearch from './SoapTemplateSearch';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

const TEMPLATES: SoapTemplate[] = [
  { id: 'tpl-derm', name: 'Dermatology consult', isDefault: true, version: 4 },
  { id: 'tpl-derm-recheck', name: 'Dermatology recheck', version: 2 },
  { id: 'tpl-wellness', name: 'Annual wellness exam', version: 7 },
  { id: 'tpl-dental', name: 'Dental assessment and charting', version: 1 },
  { id: 'tpl-ortho', name: 'Orthopaedic lameness workup', version: 3 },
];

const MANY_TEMPLATES: SoapTemplate[] = Array.from({ length: 12 }, (_, index) => ({
  id: `tpl-post-op-${index}`,
  name: `Post-operative recheck - day ${index + 1} protocol`,
  version: 1,
}));

type HarnessProps = {
  templates: SoapTemplate[];
  /**
   * Seeds the query, so the panel can be reached by props alone the way the SOAP
   * step reaches it - `templateMatches.length > 0` is the only gate.
   */
  initialQuery: string;
  onSelectTemplate: (templateId: string) => void;
};

/**
 * Mirrors `SoapStep`: the query and the ref live in the parent, and matches are
 * a memo over the encounter's templates that returns `[]` for a blank query.
 * Selecting clears the query, which is what closes the panel.
 */
const Harness = ({ templates, initialQuery, onSelectTemplate }: HarnessProps) => {
  const templateSearchRef = useRef<HTMLDivElement | null>(null);
  const [templateQuery, setTemplateQuery] = useState(initialQuery);
  const query = templateQuery.trim().toLowerCase();
  const templateMatches = query
    ? templates.filter((tpl) => tpl.name.toLowerCase().includes(query))
    : [];

  return (
    <div className="flex min-h-[520px] flex-col gap-6 p-6">
      <SoapTemplateSearch
        templateSearchRef={templateSearchRef}
        templateQuery={templateQuery}
        setTemplateQuery={setTemplateQuery}
        templateMatches={templateMatches}
        onSelectTemplate={(templateId) => {
          onSelectTemplate(templateId);
          setTemplateQuery('');
        }}
      />
      <div className="rounded-2xl border border-card-border p-4 text-[13px] text-[var(--ink-muted)]">
        Subjective / Objective editors sit here. The panel paints over this card rather than being
        clipped by it.
      </div>
    </div>
  );
};

/**
 * The list is inside the portalled panel, so it is not in `canvasElement`.
 * Returning the list keeps every assertion on real rows.
 */
const findResults = async (canvasElement: HTMLElement) => {
  const list = await within(document.body).findByRole('list');
  await expect(canvasElement.contains(list)).toBe(false);
  return list;
};

const meta = {
  title: 'Workspace/SoapTemplateSearch',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The SOAP-template picker at the top of the SOAP step: a 38px pill search field and, ' +
          'behind it, a portalled list of matching templates.\n\n' +
          'The list is gated on `templateMatches.length > 0` and nothing else - there is no ' +
          '`open` prop, no default-open state, and the field renders identically whether or not ' +
          'a panel exists. So every previous snapshot of this component was the field alone, and ' +
          'the surface a reader actually uses to change the note template had never been drawn. ' +
          'That is the same class of gap that shipped four production bugs on this branch, ' +
          'including dropdown panels coloured with fill tokens instead of ink tokens - unreadable ' +
          'text that no test could see because no test opened the panel.\n\n' +
          'What only shows with it open: the panel portals to `document.body` at `position: ' +
          'fixed`, so it escapes the section card and the sticky workspace header instead of ' +
          'being clipped by them, and its width is copied from the **anchor rect**, not from its ' +
          'content - the field is `w-full sm:max-w-90`, so long template names truncate rather ' +
          'than widening the panel.\n\n' +
          'The rows here pass `leadingIcon={null}`, unlike every other workspace search bar, ' +
          'which default to a plus glyph: choosing a template replaces the note structure rather ' +
          'than adding a line item, so the affordance is deliberately absent. They are plain ' +
          '`<button>`s inside `<li>`s - not `role="option"` - and the panel carries no listbox ' +
          'role, so anything hunting for a listbox finds nothing.\n\n' +
          'Each story counts the rows rather than checking that a panel exists: an empty panel is ' +
          'still a bordered, shadowed box.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    templates: TEMPLATES,
    initialQuery: '',
    onSelectTemplate: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Field only (no matches)',
  play: async () => {
    // With a blank query the memo returns [], the gate is false, and the portal
    // is not merely hidden - it never renders.
    await expect(within(document.body).queryByRole('list')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state, and everything a story could show before this file: the search ' +
          'field, right-aligned in its row, with no panel anywhere in the document.',
      },
    },
  },
};

export const OpenFromProps: Story = {
  name: 'Results open on mount',
  args: { initialQuery: 'derm' },
  play: async ({ canvasElement }) => {
    const list = await findResults(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(2);
    await expect(within(list).getByText('Dermatology consult')).toBeInTheDocument();
    await expect(within(list).getByText('Dermatology recheck')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mounted with matches already in the props, which is the honest reading of the gate: ' +
          'the panel is a function of `templateMatches`, not of any interaction. It measures the ' +
          'anchor after commit, so it lands 4px below the field at the field’s exact width.',
      },
    },
  },
};

export const TypingOpensIt: Story = {
  name: 'Typing opens the panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for SOAP template' }),
      'wellness'
    );
    const list = await findResults(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(1);
    await expect(within(list).getByText('Annual wellness exam')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The path a clinician takes. Matching is a case-insensitive substring over the template ' +
          'name only, so a single-row panel is a common shape - and a panel sized from its ' +
          'trigger rather than its content is only distinguishable here.',
      },
    },
  },
};

export const LongList: Story = {
  name: 'Many matches (panel scrolls, names truncate)',
  args: { templates: MANY_TEMPLATES, initialQuery: 'post-operative' },
  play: async ({ canvasElement }) => {
    const list = await findResults(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(12);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Twelve long names against a `max-h-80 overflow-auto` panel that cannot grow wider than ' +
          'the 360px field. The list scrolls inside itself - that inner scroll is exempt from the ' +
          'dismiss-on-scroll handler, so the panel survives being read - and each name truncates ' +
          'rather than wrapping.',
      },
    },
  },
};

export const SelectingATemplate: Story = {
  name: 'Selecting closes the panel',
  args: { initialQuery: 'dental' },
  play: async ({ canvasElement, args }) => {
    const list = await findResults(canvasElement);
    await userEvent.click(within(list).getByRole('button', { name: /Dental assessment/ }));
    await expect(args.onSelectTemplate).toHaveBeenCalledWith('tpl-dental');
    // The caller clears the query, the match list empties, and the portal is
    // removed from the DOM rather than hidden.
    await expect(within(document.body).queryByRole('list')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full round trip, including the part that only exists in the caller: `SoapStep` ' +
          'clears `templateQuery` once the template is applied, so the gate goes false and the ' +
          'fixed-position panel is unmounted instead of being left behind somewhere on the page.',
      },
    },
  },
};
