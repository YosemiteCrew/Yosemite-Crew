import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, within } from 'storybook/test';

import SpecialitySearchWeb from './SpecialitySearchWeb';
import type { SpecialityWeb } from '../../../features/organization/types/speciality';
// Relative, not `@/`: the Storybook Vite build does not resolve the `@/` alias
// for runtime imports inside story files.
import { useOrgStore } from '../../../stores/orgStore';

const ORG_ID = 'org-storybook';

const speciality = (name: string): SpecialityWeb => ({ name, organisationId: ORG_ID });

/**
 * The component resolves the organisation from the org store rather than taking
 * it as a prop, and refuses to add anything when there is none. Seeding the
 * store is therefore what makes selection work at all; the previous state is
 * put back when the story unmounts.
 */
const withPrimaryOrg = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: ORG_ID });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

/**
 * The field owns neither the selection nor the chips — the edit form around it
 * does — so the wrapper renders both, the way the team and organisation edit
 * drawers do.
 */
const StatefulSpecialitySearchWeb = ({
  specialities: initialSpecialities,
  multiple,
  currentSpecialities,
}: ComponentProps<typeof SpecialitySearchWeb>) => {
  const [specialities, setSpecialities] = useState<SpecialityWeb[]>(initialSpecialities);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 340 }}>
      <SpecialitySearchWeb
        specialities={specialities}
        setSpecialities={setSpecialities}
        multiple={multiple}
        currentSpecialities={currentSpecialities}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {specialities.map((item) => (
          <span
            key={item.name}
            className="text-caption-1"
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid var(--hairline)',
              background: 'var(--band)',
              color: 'var(--ink-body)',
            }}
          >
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Inputs/SpecialitySearchWeb',
  component: SpecialitySearchWeb,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The edit-form binding of the speciality type-ahead. It differs from `Inputs/SpecialitySearch` ' +
          'in two ways that matter on an edit screen: the organisation comes from the org store instead ' +
          'of a prop, and `currentSpecialities` lets the caller hide the ones already saved on the ' +
          'record, so an edit drawer only ever offers what would actually be a change.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    multiple: { control: 'boolean' },
  },
  args: {
    specialities: [],
    setSpecialities: fn(),
    multiple: true,
    currentSpecialities: [],
  },
  beforeEach: withPrimaryOrg,
  render: (args) => <StatefulSpecialitySearchWeb {...args} />,
} satisfies Meta<typeof SpecialitySearchWeb>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The resting field, with nothing picked and the dropdown closed. */
export const Default: Story = {
  name: 'Closed',
};

/**
 * Focusing the field opens the whole catalogue. The panel is `--screen` on a
 * hairline with a scroll cap, so a long list never runs off the bottom of the
 * drawer it sits in.
 */
export const DropdownOpen: Story = {
  name: 'Dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: /search or create specialty/i }));
  },
};

/**
 * The prop this wrapper exists for. Cardiology and Dermatology are already on
 * the record, so they are filtered out of the open dropdown even though nothing
 * has been picked in this session — compare the first rows with `Dropdown open`.
 */
export const ExcludesCurrent: Story = {
  name: 'Already-saved specialities hidden',
  args: {
    currentSpecialities: [speciality('Cardiology'), speciality('Dermatology')],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: /search or create specialty/i }));
  },
};

/**
 * `multiple={false}` for the fields that hold exactly one speciality: picking a
 * second replaces the first rather than appending to it.
 */
export const SingleSelection: Story = {
  name: 'Single selection',
  args: {
    multiple: false,
    specialities: [speciality('Oncology')],
  },
};
