import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SearchResultsDropdown from './SearchResultsDropdown';
import WorkspaceSearchResultRow from './WorkspaceSearchResultRow';
import Search from '@/app/ui/inputs/Search';

type Result = {
  id: string;
  name: string;
  origin?: string;
  badge?: string;
  meta?: string;
};

const SERVICES: Result[] = [
  { id: 'consult-30', name: 'Consultation - 30 min', badge: 'Service', meta: '€65.00' },
  { id: 'consult-15', name: 'Consultation - 15 min', badge: 'Service', meta: '€38.00' },
  { id: 'dental-scale', name: 'Dental scale and polish', badge: 'Package', meta: '€180.00' },
  {
    id: 'dental-xray',
    name: 'Dental radiographs',
    origin: 'Dental scale and polish',
    badge: 'Package',
    meta: 'Included',
  },
  { id: 'nail-clip', name: 'Nail clip', badge: 'Service', meta: '€12.00' },
];

const LONG_LIST: Result[] = Array.from({ length: 14 }, (_, index) => ({
  id: `medicine-${index}`,
  name: `Meloxicam 1.5 mg/ml - batch ${String(index + 1).padStart(3, '0')}`,
  badge: 'Medication',
  meta: `${40 - index} in stock`,
}));

const Badge = ({ label }: { label: string }) => (
  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
    {label}
  </span>
);

type HarnessProps = {
  results: Result[];
  /** Width of the anchor. The panel is sized from the anchor's rect, not its own content. */
  anchorWidth: string;
  /**
   * Renders a control that opens the panel regardless of match count, the way a
   * caller that forgot to gate on `matches.length` would. Off by default so the
   * docs page never mounts a `position: fixed` panel without an interaction.
   */
  forceOpenControl?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
};

/**
 * Mirrors the real call sites (`SoapTemplateSearch`, `ServicesPackagesEditor`):
 * a `Search` field inside a positioned wrapper whose ref is the anchor, and an
 * `open` derived from how many results the query matched.
 */
const Harness = ({ results, anchorWidth, forceOpenControl, onSelect, onClose }: HarnessProps) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [forced, setForced] = useState(false);
  const matches = query.trim()
    ? results.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <div className="min-h-[520px] p-6">
      <p className="mb-3 text-[13px] text-[var(--ink-muted)]">
        The panel only exists while the field has matches, so type to reach it.
      </p>
      {forceOpenControl && (
        <button
          type="button"
          onClick={() => setForced(true)}
          className="mb-3 rounded-[12px] border border-[var(--hairline)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink-body)]"
        >
          Open with no matches
        </button>
      )}
      <div className="relative flex justify-end">
        <div ref={anchorRef} className={`relative ${anchorWidth}`}>
          <Search
            value={query}
            setSearch={setQuery}
            placeholder="Search for services, packages..."
            label="Search for services and packages"
            className="w-full!"
          />
          <SearchResultsDropdown
            anchorRef={anchorRef}
            open={forced || matches.length > 0}
            onClose={() => {
              onClose();
              setQuery('');
            }}
          >
            <ul aria-label="Search results">
              {matches.map((item) => (
                <WorkspaceSearchResultRow
                  key={item.id}
                  name={item.name}
                  origin={item.origin}
                  badge={item.badge ? <Badge label={item.badge} /> : undefined}
                  meta={item.meta}
                  onSelect={() => {
                    onSelect(item.id);
                    setQuery('');
                  }}
                />
              ))}
            </ul>
          </SearchResultsDropdown>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-card-border p-4 text-[13px] text-[var(--ink-muted)]">
        Section card underneath. The panel escapes it rather than being clipped by it.
      </div>
    </div>
  );
};

/**
 * The list lives inside the portalled panel, so it is outside `canvasElement`.
 * Returning the list rather than the panel keeps the assertions on real content.
 */
const findResultsList = async (canvasElement: HTMLElement) => {
  const list = await within(document.body).findByRole('list', { name: 'Search results' });
  // Prove it really portalled: the panel is a direct child of <body>, and the
  // list is nowhere inside the story canvas.
  await expect(canvasElement.contains(list)).toBe(false);
  await expect(list.parentElement?.parentElement).toBe(document.body);
  return list;
};

const meta = {
  title: 'Appointments/SearchResultsDropdown',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The results panel behind every AppointmentWorkspace search bar - SOAP templates, ' +
          'services and packages, prescriptions, the summary step.\n\n' +
          'It renders `null` until someone types. There is no prop that reveals it and no ' +
          'default-open state: `open`, a non-empty measured anchor rect, and a live `document` ' +
          'all have to be true at once before it returns anything at all. That is why every ' +
          'story here opens it with a `play` function that types into the field, and why no ' +
          'snapshot had ever contained it - the same blind spot that let four production bugs ' +
          'ship on this branch, among them a popover whose comma-separated grid template was ' +
          'invalid CSS and collapsed six children into one column.\n\n' +
          'The reason this component exists at all is only visible with it open. It portals to ' +
          '`document.body` at `position: fixed`, `zIndex: 1000`, precisely so it escapes every ' +
          'local stacking context - the section cards, the sticky workspace header, the ' +
          'transformed line-item rows - which is what used to hide results behind sibling ' +
          'cards and row action icons. The stories assert the panel is a direct child of ' +
          '`<body>` rather than merely present, because a panel that renders in place looks ' +
          'identical until something overlaps it.\n\n' +
          'Its geometry comes from `useSyncExternalStore` over the anchor rect - `top: ' +
          'rect.bottom + 4`, `left: rect.left`, and `width: rect.width` - so the panel is the ' +
          'width of the **search field**, never of its own content. A long result name truncates ' +
          'rather than widening the panel, which is only checkable side by side with a narrow ' +
          'anchor.\n\n' +
          'The rows are `<button>`s inside `<li>`s, not `role="option"`, and the panel itself has ' +
          'no listbox role - so anything hunting for a listbox finds nothing here.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    results: SERVICES,
    anchorWidth: 'w-full sm:max-w-90',
    onSelect: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Field only (nothing typed)',
  parameters: {
    docs: {
      description: {
        story:
          'The resting state, and the only one any previous story could show: a 38px pill search ' +
          'field and no panel in the DOM at all.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Results panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'consult'
    );
    const list = await findResultsList(canvasElement);
    // Assert the panel has rows, not merely that it mounted - an empty panel is
    // still a rounded, bordered, shadowed box and passes every weaker check.
    await expect(within(list).getAllByRole('button')).toHaveLength(2);
    await expect(within(list).getByText('Consultation - 30 min')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two matches. The panel sits 4px under the field, takes the field’s width, and paints ' +
          'on `bg-neutral-0` with a `border-card-border` hairline over the section card below it ' +
          '- which is the whole point of portalling it.',
      },
    },
  },
};

export const RichRows: Story = {
  name: 'Rows with badge, origin and meta',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'dental'
    );
    const list = await findResultsList(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(2);
    // The string appears twice on purpose: once as the first row's own name, and
    // once as the second row's origin line. Two hits is the assertion - one would
    // mean the origin line silently stopped rendering.
    await expect(within(list).getAllByText('Dental scale and polish')).toHaveLength(2);
    await expect(within(list).getByText('Dental radiographs')).toBeInTheDocument();
    await expect(within(list).getByText('Included')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every slot a result row can fill at once: a badge, a right-aligned meta column, and - ' +
          'on the second row - an origin line naming the package the item came from. The badge ' +
          'and meta are `shrink-0` against a `truncate` name, so a long name gives up width ' +
          'rather than pushing them out of a panel it cannot widen.',
      },
    },
  },
};

export const ScrollingList: Story = {
  name: 'Long list (max-h-80 scrolls)',
  args: { results: LONG_LIST },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'meloxicam'
    );
    const list = await findResultsList(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(14);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Fourteen matches against a `max-h-80 overflow-auto` panel, so the list scrolls inside ' +
          'itself. That inner scroll is deliberately exempt from the dismiss-on-scroll handler - ' +
          'the panel closes when the *page* scrolls away from the anchor but stays open while ' +
          'the reader scrolls the results - and there is no way to see that without a list long ' +
          'enough to scroll.',
      },
    },
  },
};

export const NarrowAnchor: Story = {
  name: 'Narrow anchor (panel truncates)',
  args: { results: LONG_LIST, anchorWidth: 'w-[220px]' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'meloxicam'
    );
    const list = await findResultsList(canvasElement);
    await expect(within(list).getAllByRole('button')).toHaveLength(14);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same long medication names against a 220px anchor. Because the panel width is ' +
          'copied from the anchor rect, it cannot grow - the names truncate and the "in stock" ' +
          'meta keeps its width. Worth reading beside the wide-anchor story, since a panel that ' +
          'sized itself from its content would look correct in exactly one of them.',
      },
    },
  },
};

export const SelectingAResult: Story = {
  name: 'Selecting a result closes the panel',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'nail'
    );
    const list = await findResultsList(canvasElement);
    await userEvent.click(within(list).getByRole('button', { name: /Nail clip/ }));
    await expect(args.onSelect).toHaveBeenCalledWith('nail-clip');
    // Clearing the query empties the matches, which unmounts the whole portal.
    await expect(
      within(document.body).queryByRole('list', { name: 'Search results' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full round trip. Callers clear the query on select, so the match list empties and ' +
          '`open` goes false - the panel is removed from the DOM rather than hidden, which is ' +
          'what keeps a stale fixed-position panel from surviving a re-render somewhere else on ' +
          'the page.',
      },
    },
  },
};

export const DismissOnOutsideClick: Story = {
  name: 'Dismissed by an outside press',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' }),
      'consult'
    );
    await findResultsList(canvasElement);
    // A press that lands outside BOTH the anchor and the portal panel closes it;
    // the panel is not inside the anchor, so `contains` has to be checked twice.
    await userEvent.click(canvas.getByText(/Section card underneath/));
    await expect(args.onClose).toHaveBeenCalled();
    await expect(
      within(document.body).queryByRole('list', { name: 'Search results' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Because the panel is portalled it is not a DOM descendant of the field, so the ' +
          'outside-press check has to test the anchor and the panel separately. Getting that ' +
          'wrong makes the panel close the instant a reader clicks a result - a bug that only ' +
          'exists once the panel is open, and so only a story like this one can catch.',
      },
    },
  },
};

export const EmptyPanel: Story = {
  name: 'Open with no results (what to avoid)',
  args: { forceOpenControl: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open with no matches' }));
    const list = await findResultsList(canvasElement);
    await expect(within(list).queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a caller that opens the panel without gating on `matches.length` produces: a ' +
          'bordered, shadowed, full-width box with nothing inside it. The component has no empty ' +
          'state of its own - the callers own that decision - so this is a real shape the ' +
          'workspace can render. It is also exactly the state an assertion on `open` or on ' +
          '`aria-expanded` would call healthy, which is why every other story here counts rows.',
      },
    },
  },
};
