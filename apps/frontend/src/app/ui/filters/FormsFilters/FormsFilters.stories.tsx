import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import FormsFilters, { type FormsFilterState } from './index';
import { Secondary } from '../../primitives/Buttons';
import { useOrgStore } from '../../../stores/orgStore';

/**
 * The category list narrows to the primary organisation's type, and the org
 * store persists to localStorage — so without this the label would depend on
 * whichever story ran before. No primary org means the whole taxonomy is
 * offered, which is the widest case to review.
 */
const detachPrimaryOrg = () => {
  const previousOrgState = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: null });
  return () => {
    useOrgStore.setState(previousOrgState);
  };
};

/**
 * Controlled wrapper. `FormsFilters` owns no filter state — the forms page
 * holds it — so each story keeps it locally and lets the pills actually react.
 */
const ControlledFormsFilters = (args: ComponentProps<typeof FormsFilters>) => {
  const [filters, setFilters] = useState<FormsFilterState>(args.filters);
  return (
    <FormsFilters
      {...args}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        args.onFiltersChange(next);
      }}
    />
  );
};

const meta = {
  title: 'Filters/FormsFilters',
  component: FormsFilters,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Toolbar above the forms list: a row of status pills on the left, and a category dropdown (plus an optional ' +
          'action slot) pinned right. The active status pill keeps its own tone; every inactive pill flattens to a ' +
          'transparent `--hairline` outline in `--ink-muted`, which is how the row reads as single-select. ' +
          'The category list is derived from the primary organisation type in the org store; these stories clear the primary org, so the whole taxonomy is on offer.\n\n' +
          'The pills are the visible half. The category panel is not: it lives behind ' +
          '`useState(open)`, and once open it is `createPortal`ed to `document.body` and placed ' +
          '`fixed` from a trigger rect measured in the click handler, so it is outside the story ' +
          'canvas entirely and no snapshot had ever contained it. That is the gap worth naming - ' +
          'four production bugs on this branch lived on surfaces reachable only after an ' +
          'interaction, among them dropdown panels whose option text was painted with fill tokens ' +
          'instead of ink tokens. tsc, eslint and jest all pass on that.\n\n' +
          'The panel is a `max-h-64 overflow-y-auto` stack of plain buttons - deliberately not a ' +
          'listbox or a menu, since it implements no keyboard model - where the chosen row is ' +
          'marked with `aria-current`, an `--inset` fill and a trailing check, and every other row ' +
          'stays `--ink-muted`. With no primary org the whole taxonomy is offered, which is also ' +
          'the case that overflows the 16rem cap and makes the panel scroll.\n\n' +
          'The stories below open it in a `play` function and assert it carries real options, not ' +
          'merely that the trigger flipped `aria-expanded` - the weak check passes on an empty panel.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filters: { status: 'All', category: 'All' },
    onFiltersChange: fn(),
  },
  render: (args) => <ControlledFormsFilters {...args} />,
  beforeEach: detachPrimaryOrg,
} satisfies Meta<typeof FormsFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unfiltered: "All" is the active pill and the dropdown reads "All categories". */
export const Default: Story = {};

/**
 * A status is active. `Published` keeps its success tone while `All`, `Draft`
 * and `Archived` drop back to the muted outline.
 */
export const StatusSelected: Story = {
  args: { filters: { status: 'Published', category: 'All' } },
};

/**
 * A category is chosen too. The trigger truncates rather than growing, which
 * matters because the taxonomy includes labels as long as
 * "Groomer - Service Request & Preferences".
 */
export const CategorySelected: Story = {
  args: { filters: { status: 'Draft', category: 'Groomer - Service Request & Preferences' } },
};

/**
 * With the optional `categoryAction` slot filled — the forms page passes its
 * "New form" button here, ahead of the hairline separator.
 */
export const WithCategoryAction: Story = {
  args: {
    categoryAction: <Secondary text="New form" href="#" size="compact" />,
  },
};

/**
 * Opens the portalled category panel. It is outside `canvasElement`, so it is
 * located on the document by the test id the component already ships.
 */
const openCategoryPanel = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: /^Category:/ }));
  return within(document.body).findByTestId('category-menu');
};

/**
 * Categories every org type carries, whatever the store holds - so these hold
 * whether or not an org type is in play.
 */
const ALWAYS_OFFERED = ['SOAP', 'Consent form', 'Prescription', 'Custom'];

export const CategoryPanelOpen: Story = {
  name: 'Category panel open',
  play: async ({ canvasElement }) => {
    const panel = await openCategoryPanel(canvasElement);
    // Assert the panel has its options and its selection mark - an empty panel
    // would still satisfy an aria-expanded check on the trigger.
    await expect(within(panel).getByTestId('option-All')).toHaveTextContent('All categories');
    for (const category of ALWAYS_OFFERED) {
      await expect(within(panel).getByTestId(`option-${category}`)).toBeInTheDocument();
    }
    await expect(within(panel).getAllByRole('button').length).toBeGreaterThan(
      ALWAYS_OFFERED.length
    );
    // "All categories" is the current choice, so it is the row carrying aria-current.
    await expect(within(panel).getByTestId('option-All')).toHaveAttribute('aria-current', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. Rows are `flex justify-between` with a truncating label and a check ' +
          'on the chosen one, and the panel caps at `max-h-64` with its own scroll - which the ' +
          'full taxonomy exceeds, so this is also the story where the scroll actually engages.',
      },
    },
  },
};

export const ChoosingACategory: Story = {
  name: 'Choosing a category',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openCategoryPanel(canvasElement);
    await userEvent.click(within(panel).getByTestId('option-SOAP'));
    // Choosing closes the panel and rewrites the trigger's label and aria-label.
    await expect(within(document.body).queryByTestId('category-menu')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Category: SOAP' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two interactions deep. The trigger is labelled `Category: <selection>` rather than by ' +
          'its visible text alone, so the chosen value is announced even though the control is a ' +
          'plain button with no listbox semantics - and that label only changes after a real ' +
          'selection.',
      },
    },
  },
};

export const NarrowCategoryPanel: Story = {
  name: 'Category panel with an action beside it',
  args: {
    categoryAction: <Secondary text="New form" href="#" size="compact" />,
    filters: { status: 'Draft', category: 'All' },
  },
  play: async ({ canvasElement }) => {
    const panel = await openCategoryPanel(canvasElement);
    await expect(within(panel).getByTestId('option-All')).toBeInTheDocument();
    await expect(within(panel).getAllByRole('button').length).toBeGreaterThan(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel opening while the "New form" action and the 18px hairline separator sit to ' +
          "the trigger's left. The panel is right-aligned to the trigger rect, so it hangs back " +
          'across those controls rather than off the edge of the toolbar - only visible with both ' +
          'on screen at once.',
      },
    },
  },
};
