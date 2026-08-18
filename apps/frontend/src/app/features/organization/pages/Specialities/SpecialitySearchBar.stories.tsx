import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SpecialitySearchBar from './SpecialitySearchBar';
import type { SearchResult } from './specialityAccordionHelpers';

const CATALOG: SearchResult[] = [
  { id: 'svc-consult', name: 'Consultation - 30 min', kind: 'service', meta: 'SVC-001' },
  { id: 'svc-recheck', name: 'Consultation - recheck', kind: 'service', meta: 'SVC-002' },
  { id: 'svc-derm-workup', name: 'Dermatology workup', kind: 'service', meta: 'SVC-014' },
  { id: 'pkg-dental', name: 'Dental scale and polish', kind: 'package', meta: 'PKG-003 - 4 items' },
  { id: 'pkg-puppy', name: 'Puppy starter package', kind: 'package', meta: 'PKG-007 - 6 items' },
];

type HarnessProps = {
  specialityName: string;
  /** The whole catalog; the harness filters it the way the accordion does. */
  results: SearchResult[];
  initialQuery: string;
  initialOpen: boolean;
  onSelectResult: (result: SearchResult) => void;
};

/**
 * Reproduces `SpecialityAccordionRevamp`'s ownership of this bar: it holds the
 * query and the open flag, opens on focus and on every keystroke, closes on
 * Escape and on clear, and defers the blur-close by 150ms so a mousedown on a
 * result still lands.
 */
const Harness = ({
  specialityName,
  results,
  initialQuery,
  initialOpen,
  onSelectResult,
}: HarnessProps) => {
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(initialOpen);
  const query = searchQuery.trim().toLowerCase();
  const searchResults = query
    ? results.filter((result) => result.name.toLowerCase().includes(query))
    : results;

  return (
    <div className="flex min-h-[420px] flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-bold text-[var(--ink)]">{specialityName}</span>
        <SpecialitySearchBar
          searchRef={searchRef}
          specialityName={specialityName}
          searchQuery={searchQuery}
          searchOpen={searchOpen}
          searchResults={searchResults}
          onQueryChange={(value) => {
            setSearchQuery(value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchQuery('');
              setSearchOpen(false);
            }
          }}
          onClear={() => {
            setSearchQuery('');
            setSearchOpen(false);
          }}
          onSelectResult={(result) => {
            onSelectResult(result);
            setSearchQuery('');
            setSearchOpen(false);
          }}
        />
      </div>
      <div className="rounded-2xl border border-card-border p-4 text-[13px] text-[var(--ink-muted)]">
        Services / packages table sits here, underneath the panel.
      </div>
    </div>
  );
};

const meta = {
  title: 'Organization/SpecialitySearchBar',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The per-speciality search field in the Specialities catalog, and the results panel ' +
          'that drops out of it.\n\n' +
          'The panel is gated on `searchOpen && searchQuery.trim()`, both owned by the parent ' +
          'accordion, so the component renders as a bare 42px field until two props line up at ' +
          'once. Neither the results list nor - more importantly - the **"No results found." ' +
          'panel** had ever been drawn. An empty-state panel is precisely the shape that ' +
          'regressions hide in: a bordered, shadowed box whose only content is one line of ' +
          '`text-text-secondary`, which is exactly what a dropdown coloured with fill tokens ' +
          'instead of ink tokens looks like right up until someone tries to read it.\n\n' +
          'The panel is `absolute`, not portalled: `top-full left-0` on phones, but ' +
          '`sm:left-auto sm:right-0` from the small breakpoint, so it hangs from the **right** ' +
          'edge of a 256px field and is `sm:w-96` (384px) - wider than the control that opened ' +
          'it. It also carries `z-50` and `overflow-hidden`, so the first and last rows are ' +
          'clipped to the 16px radius rather than squaring it off. None of that is checkable ' +
          'with the panel closed.\n\n' +
          'Rows are plain `<button>`s - no `role="option"`, no listbox - and they fire on ' +
          '`onMouseDown` rather than `onClick`, because the parent closes the panel 150ms after ' +
          'blur and a click would otherwise arrive after the row had gone. The stories drive the ' +
          'real handler set from the accordion so that ordering is exercised rather than ' +
          'assumed.\n\n' +
          'Every story asserts what is inside the panel - row count, or the empty line - never ' +
          'just that the panel mounted.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityName: 'Dermatology',
    results: CATALOG,
    initialQuery: '',
    initialOpen: false,
    onSelectResult: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Field only',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the field: no clear button (it is gated on the query) and no panel.
    await expect(canvas.getByRole('textbox', { name: 'Search within Dermatology' })).toHaveValue(
      ''
    );
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Consultation/ })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting field: a 42px rounded-2xl control with the magnifier pinned right and no ' +
          'clear affordance until something is typed.',
      },
    },
  },
};

export const Results: Story = {
  name: 'Results panel open',
  args: { initialQuery: 'consultation', initialOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Count the rows: the panel existing is not the same as the panel listing.
    await expect(canvas.getByRole('button', { name: /Consultation - 30 min/ })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: /Consultation - recheck/ })
    ).toBeInTheDocument();
    await expect(canvas.getByText('SVC-001')).toBeInTheDocument();
    await expect(canvas.queryByText('No results found.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two matches, each a full-width row with the name on the left (13px, `truncate`) and ' +
          'the code/meta on the right (12px, `shrink-0`). The panel is right-aligned to the field ' +
          'and wider than it, so it extends leftwards over the table below.',
      },
    },
  },
};

export const NoResults: Story = {
  name: 'No results found',
  args: { initialQuery: 'ultrasound', initialOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No results found.')).toBeInTheDocument();
    // The empty branch must not also render rows.
    await expect(canvas.queryByRole('button', { name: /Consultation/ })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch that had never been rendered anywhere. It is a single `px-4 py-2` line of ' +
          '`text-text-secondary` in the same bordered, shadowed box as a full list - so the ' +
          'panel keeps its width and radius while holding one short sentence, and the only thing ' +
          'carrying the message is that one ink token.',
      },
    },
  },
};

export const TypingToEmpty: Story = {
  name: 'Typing down to the empty panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Search within Dermatology' });
    await userEvent.type(field, 'dent');
    await expect(
      canvas.getByRole('button', { name: /Dental scale and polish/ })
    ).toBeInTheDocument();
    // One more character and the same panel flips to its empty branch in place.
    await userEvent.type(field, 'ist');
    await expect(canvas.getByText('No results found.')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Dental/ })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The transition a reader actually sees: a matching row, then the empty line, in the ' +
          'same box without it closing. Worth a story of its own because the panel shrinks from ' +
          'a row to a sentence while staying anchored to the right edge of the field.',
      },
    },
  },
};

export const SelectingAResult: Story = {
  name: 'Selecting a result',
  args: { initialQuery: 'puppy', initialOpen: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Puppy starter package/ }));
    await expect(args.onSelectResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pkg-puppy', kind: 'package' })
    );
    // The parent clears the query and closes, which removes the panel entirely.
    await expect(canvas.queryByText('No results found.')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: /Puppy starter package/ })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A package row selected. The result carries its `kind`, which is what tells the ' +
          'accordion whether to switch to the Services tab or the Packages tab - the panel is a ' +
          'navigation control as much as a filter, and that is only legible with it open.',
      },
    },
  },
};

export const ClearButton: Story = {
  name: 'Clear button dismisses',
  args: { initialQuery: 'consultation', initialOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The clear affordance only exists while there is a query, so it is itself a
    // gated surface sitting inside the field.
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    await expect(canvas.getByRole('textbox', { name: 'Search within Dermatology' })).toHaveValue(
      ''
    );
    await expect(canvas.queryByRole('button', { name: /Consultation/ })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The 12px cross between the input and the magnifier, present only while the field has ' +
          'text. It clears the query and closes the panel in one step, so the row it sits in ' +
          'goes from three children back to two.',
      },
    },
  },
};
