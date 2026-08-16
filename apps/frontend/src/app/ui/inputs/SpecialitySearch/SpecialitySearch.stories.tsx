import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, within } from 'storybook/test';
import type { Speciality } from '@yosemite-crew/types';
import SpecialitySearch from './SpecialitySearch';

const ORG_ID = 'org-storybook';

/**
 * The component only owns the field and its dropdown — the selected chips are
 * the caller's job — so the wrapper renders both, which is what the settings
 * and onboarding screens do around it.
 */
const StatefulSpecialitySearch = ({
  organisationId,
  specialities: initialSpecialities,
  multiple,
}: ComponentProps<typeof SpecialitySearch>) => {
  const [specialities, setSpecialities] = useState<Speciality[]>(initialSpecialities);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 340 }}>
      <SpecialitySearch
        organisationId={organisationId}
        specialities={specialities}
        setSpecialities={setSpecialities}
        multiple={multiple}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {specialities.map((speciality) => (
          <span
            key={speciality.name}
            className="text-caption-1"
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid var(--hairline)',
              background: 'var(--band)',
              color: 'var(--ink-body)',
            }}
          >
            {speciality.name}
          </span>
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Inputs/SpecialitySearch',
  component: SpecialitySearch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Type-ahead over the built-in speciality list that doubles as a create field: if nothing ' +
          'matches, the dropdown offers to add the typed name instead. Selections are appended to ' +
          "the caller's `specialities` array and disappear from the list, so the same speciality " +
          'cannot be added twice.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    multiple: { control: 'boolean' },
  },
  args: {
    organisationId: ORG_ID,
    specialities: [],
    setSpecialities: fn(),
    multiple: true,
  },
  render: (args) => <StatefulSpecialitySearch {...args} />,
} satisfies Meta<typeof SpecialitySearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Closed',
};

export const WithSelection: Story = {
  name: 'With selections',
  args: {
    specialities: [
      { name: 'Cardiology', organisationId: ORG_ID },
      { name: 'Dermatology', organisationId: ORG_ID },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Already-selected specialities are filtered out of the dropdown, which is why the ' +
          'component needs the current array rather than just a change handler.',
      },
    },
  },
};

export const ResultsOpen: Story = {
  name: 'Dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: /search or create specialty/i }));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Focusing the field opens the full list. The panel is `--screen` on a hairline with a ' +
          '200px scroll cap, so a long catalogue never runs off the bottom of a settings drawer.',
      },
    },
  },
};

export const CreateNew: Story = {
  name: 'No match (create)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /search or create specialty/i });
    await userEvent.click(input);
    await userEvent.type(input, 'Exotic reptile medicine');
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the query matches nothing the dropdown collapses to a single create row. The name ' +
          'is capitalised on save, so "exotic reptile medicine" is stored as "Exotic reptile ' +
          'medicine".',
      },
    },
  },
};
