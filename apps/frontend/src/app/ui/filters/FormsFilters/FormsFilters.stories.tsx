import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
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
  return <FormsFilters {...args} filters={filters} onFiltersChange={setFilters} />;
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
          'The category list is derived from the primary organisation type in the org store; these stories clear the primary org, so the whole taxonomy is on offer.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filters: { status: 'All', category: 'All' },
    onFiltersChange: () => {},
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
