import type { Meta, StoryObj } from '@storybook/react';
import { useSearchStore } from '@/app/stores/searchStore';
import MobileSearchBar from './MobileSearchBar';

/**
 * The bar reads and writes the shared `searchStore` rather than taking a value
 * prop, so a story seeds the store instead of passing an arg. It is a plain Zustand
 * store with no provider and no fetching, so this is the whole of the "mock", and
 * `beforeEach` keeps the write out of a React render.
 *
 * No `autodocs` tag on purpose: the store is global, so a docs page that mounts
 * every story at once would show whichever one seeded last in all of them.
 */
const seedQuery = (query: string) => () => {
  useSearchStore.setState({ query });
};

const meta = {
  title: 'Layout/MobileSearchBar',
  component: MobileSearchBar,
  // `lg:hidden` removes the bar from 1024px up — at the preview's default laptop
  // viewport it renders nothing, so every story here is pinned to phone width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The phone and tablet stand-in for the desktop header search. It is hidden from `lg` up ' +
          '(`lg:hidden`), keeps its value in the shared `searchStore` so the list below it reads the ' +
          'same query, and pairs a visually hidden `<label>` with the placeholder so the field is ' +
          'still named for a screen reader. The border switches to `--input-border-active` on ' +
          'focus-within.',
      },
    },
  },
  beforeEach: seedQuery(''),
  decorators: [
    (Story) => (
      <div style={{ width: 351 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileSearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty',
};

export const WithQuery: Story = {
  name: 'With a query',
  beforeEach: seedQuery('Amoxicillin'),
  parameters: {
    docs: {
      description: {
        story:
          'A seeded store value. `type="search"` means the browser paints its own clear affordance ' +
          'once there is text, which is why the component adds no clear button of its own.',
      },
    },
  },
};

export const CustomPlaceholder: Story = {
  name: 'Custom placeholder',
  args: { placeholder: 'Search companions' },
  parameters: {
    docs: {
      description: {
        story:
          'The `placeholder` prop does double duty as the accessible name, through both the ' +
          '`sr-only` label and `aria-label`. Give it a per-page value rather than leaving the ' +
          'generic "Search" on every screen.',
      },
    },
  },
};
