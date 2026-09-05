import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { specialties } from '@/app/lib/specialities';
import { useOrgStore } from '@/app/stores/orgStore';
import SpecialitySearchBase from './SpecialitySearchBase';

const ORG_ID = 'org-storybook';
const STORE_ORG_ID = 'org-meadowbrook';
const FIELD = 'Search or create specialty';
const RESULTS = 'Speciality results';
const SELECTED = 'Selected specialities';

type Item = { name: string; organisationId?: string };

/** Typed fixtures rather than inline literals: an object literal with `organisationId` fails the excess-property check against the component's inferred `{ name }` args. */
const CARDIOLOGY_ONLY: Item[] = [{ name: 'Cardiology', organisationId: ORG_ID }];
const CARDIOLOGY_AND_DERMATOLOGY: Item[] = [
  { name: 'Cardiology', organisationId: ORG_ID },
  { name: 'Dermatology', organisationId: ORG_ID },
];

type HarnessProps = {
  organisationId?: string | null;
  initial: Item[];
  multiple?: boolean;
  currentSpecialities?: Item[];
};

/**
 * The component owns the field and the dropdown; the selected chips are the
 * caller's. The harness renders both, and prints the organisation each chip
 * was stamped with, because which organisation ends up on a new speciality is
 * the one thing the base component decides on its own.
 */
const Harness = ({ organisationId, initial, multiple, currentSpecialities }: HarnessProps) => {
  const [items, setItems] = useState<Item[]>(initial);

  return (
    <div style={{ display: 'grid', gap: 12, width: 340, paddingBottom: 260 }}>
      <SpecialitySearchBase<Item>
        organisationId={organisationId}
        specialities={items}
        setSpecialities={setItems}
        multiple={multiple}
        currentSpecialities={currentSpecialities}
      />
      <ul
        aria-label={SELECTED}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item) => (
          <li
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
            <span>{item.name}</span>
            <span style={{ color: 'var(--ink-faint)' }}> · {item.organisationId ?? 'no org'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * The fallback organisation is read from the (persisted) org store, so every
 * story starts with it empty and the one that wants a primary org seeds it.
 */
const withNoPrimaryOrg = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: null });
  return () => useOrgStore.setState({ primaryOrgId: snapshot.primaryOrgId });
};

const withPrimaryOrg = () => {
  useOrgStore.setState({ primaryOrgId: STORE_ORG_ID });
  return () => useOrgStore.setState({ primaryOrgId: null });
};

const meta = {
  title: 'Inputs/SpecialitySearchBase',
  component: SpecialitySearchBase,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The generic type-ahead behind `SpecialitySearch` and `SpecialitySearchWeb`. It lists ' +
          'the built-in speciality catalogue, hides anything already in `specialities` or in ' +
          '`currentSpecialities` (the ones the organisation already has), and offers to create ' +
          'the typed name when nothing matches. New entries are `{ name, organisationId }`, with ' +
          'the organisation taken from the `organisationId` prop or, failing that, the primary ' +
          'organisation in the org store; with neither, a pick is silently ignored. `multiple` ' +
          'is on by default and appends; off, every pick replaces the whole selection. Created ' +
          'names are capitalised and go to the front of the list, catalogue picks go to the back.',
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
  render: (args) => (
    <Harness
      organisationId={args.organisationId}
      initial={args.specialities}
      multiple={args.multiple}
      currentSpecialities={args.currentSpecialities}
    />
  ),
  beforeEach: withNoPrimaryOrg,
} satisfies Meta<typeof SpecialitySearchBase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: FIELD })).toHaveValue('');
    await expect(canvas.queryByLabelText(RESULTS)).not.toBeInTheDocument();
  },
};

export const DropdownOpen: Story = {
  name: 'Dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(results.getAllByRole('button')).toHaveLength(specialties.length);
    await expect(results.getByRole('button', { name: 'Cardiology' })).toBeInTheDocument();
    await expect(results.getByRole('button', { name: 'Dentistry' })).toBeInTheDocument();
  },
};

export const PickAppends: Story = {
  name: 'Pick appends a speciality',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.click(canvas.getByRole('button', { name: 'Cardiology' }));

    const chips = within(canvas.getByRole('list', { name: SELECTED }));
    await expect(chips.getByText('Cardiology')).toBeInTheDocument();
    await expect(chips.getByText(`· ${ORG_ID}`)).toBeInTheDocument();
    await expect(canvas.queryByLabelText(RESULTS)).not.toBeInTheDocument();
    await expect(field).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A catalogue pick with `organisationId` supplied. The chip carries that organisation, ' +
          'the dropdown closes and the field clears.',
      },
    },
  },
};

export const CreateCapitalised: Story = {
  name: 'No match (create, capitalised)',
  args: {
    specialities: CARDIOLOGY_ONLY,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.type(field, 'exotic reptile medicine');
    await userEvent.click(
      canvas.getByRole('button', { name: 'New speciality “exotic reptile medicine”' })
    );

    const chips = within(canvas.getByRole('list', { name: SELECTED }));
    const names = chips.getAllByRole('listitem').map((item) => item.firstElementChild?.textContent);
    // Capitalised, and prepended rather than appended.
    await expect(names).toEqual(['Exotic reptile medicine', 'Cardiology']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The create row. The stored name gets a capital first letter and goes to the FRONT of ' +
          'the list, unlike a catalogue pick, so a practice sees the speciality it just invented ' +
          'before the standard ones.',
      },
    },
  },
};

export const SingleSelect: Story = {
  name: 'Single select replaces',
  args: {
    multiple: false,
    specialities: CARDIOLOGY_ONLY,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    await userEvent.click(canvas.getByRole('button', { name: 'Dermatology' }));

    const chips = within(canvas.getByRole('list', { name: SELECTED }));
    await expect(chips.getAllByRole('listitem')).toHaveLength(1);
    await expect(chips.getByText('Dermatology')).toBeInTheDocument();
    await expect(chips.queryByText('Cardiology')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`multiple={false}`, as the team-member form uses it. Picking Dermatology replaces ' +
          'Cardiology rather than joining it.',
      },
    },
  },
};

export const CurrentHidden: Story = {
  name: 'Existing organisation specialities hidden',
  args: {
    currentSpecialities: CARDIOLOGY_AND_DERMATOLOGY,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(results.getAllByRole('button')).toHaveLength(specialties.length - 2);
    await expect(results.queryByRole('button', { name: 'Cardiology' })).not.toBeInTheDocument();
    await expect(results.queryByRole('button', { name: 'Dermatology' })).not.toBeInTheDocument();
    await expect(results.getByRole('button', { name: 'Dentistry' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`currentSpecialities` are the ones the organisation already runs. They are filtered ' +
          'exactly like the current selection, so the add-speciality dialog cannot offer one the ' +
          'practice has.',
      },
    },
  },
};

export const FallsBackToPrimaryOrg: Story = {
  name: 'Organisation from the store',
  args: {
    organisationId: undefined,
  },
  beforeEach: withPrimaryOrg,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    await userEvent.click(canvas.getByRole('button', { name: 'Ophthalmology' }));

    const chips = within(canvas.getByRole('list', { name: SELECTED }));
    await expect(chips.getByText('Ophthalmology')).toBeInTheDocument();
    await expect(chips.getByText(`· ${STORE_ORG_ID}`)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'No `organisationId` prop: the new entry is stamped with the primary organisation from ' +
          'the org store instead. This is how the settings screen uses it.',
      },
    },
  },
};

export const NoOrganisation: Story = {
  name: 'No organisation (pick ignored)',
  args: {
    organisationId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cardiology' }));

    // Nothing to stamp the speciality with, so nothing is added - and the
    // dropdown stays open, because the early return skips the close as well.
    await expect(
      within(canvas.getByRole('list', { name: SELECTED })).queryAllByRole('listitem')
    ).toHaveLength(0);
    await expect(canvas.getByLabelText(RESULTS)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Neither a prop nor a primary organisation. The pick is dropped without feedback and ' +
          'the list stays open. Pinned here so the silence is a known behaviour rather than a ' +
          'surprise in onboarding, where the org may not exist yet.',
      },
    },
  },
};
