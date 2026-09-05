import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Organisation, Service } from '@yosemite-crew/types';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';

import { useOrgStore } from '@/app/stores/orgStore';
import ServiceSearch from './ServiceSearch';

const ORG_ID = 'org-meadowbrook';
const FIELD = 'Search or create service';
const RESULTS = 'Service results';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Meadowbrook Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

const service = (name: string, specialityId: string): Service => ({
  id: name.toLowerCase().replaceAll(/\W+/g, '-'),
  organisationId: ORG_ID,
  name,
  durationMinutes: 30,
  cost: 60,
  specialityId,
  isActive: true,
});

const DENTISTRY: SpecialityWeb = {
  _id: 'speciality-dentistry',
  organisationId: ORG_ID,
  name: 'Dentistry',
  services: [],
};

/** A second speciality in the same array, to show the update leaves it alone. */
const CARDIOLOGY: SpecialityWeb = {
  _id: 'speciality-cardiology',
  organisationId: ORG_ID,
  name: 'Cardiology',
  services: [service('Heart Check-up', 'speciality-cardiology')],
};

/**
 * The component only owns the field; the onboarding step around it owns the
 * `specialities` array and draws the chips. The harness does the same, with
 * two specialities in the array so a story can prove that adding to one never
 * touches the other.
 */
const Harness = ({ speciality }: { speciality: SpecialityWeb }) => {
  const [specialities, setSpecialities] = useState<SpecialityWeb[]>([speciality, CARDIOLOGY]);
  const current = specialities.find((entry) => entry.name === speciality.name) ?? speciality;
  const sibling = specialities.find((entry) => entry.name === CARDIOLOGY.name) ?? CARDIOLOGY;

  return (
    <div style={{ width: 340, display: 'grid', gap: 12, paddingBottom: 280 }}>
      <ServiceSearch speciality={current} setSpecialities={setSpecialities} />
      <ul
        aria-label={`${current.name} services`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {(current.services ?? []).map((entry) => (
          <li
            key={entry.name}
            className="text-caption-1"
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid var(--hairline)',
              background: 'var(--band)',
              color: 'var(--ink-body)',
            }}
          >
            <span>{entry.name}</span>
            <span style={{ color: 'var(--ink-faint)' }}> · {entry.durationMinutes} min</span>
          </li>
        ))}
      </ul>
      <p className="text-caption-1" style={{ color: 'var(--ink-faint)', margin: 0 }}>
        Cardiology services: {sibling.services?.length ?? 0}
      </p>
    </div>
  );
};

/**
 * The service builder stamps every new service with the primary organisation
 * and resolves its template against that organisation's business type, so a
 * hospital is seeded as primary. The store is persisted; the snapshot goes back.
 */
const withHospital = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
  });
  return () => {
    useOrgStore.setState({
      orgsById: snapshot.orgsById,
      orgIds: snapshot.orgIds,
      primaryOrgId: snapshot.primaryOrgId,
    });
  };
};

const meta = {
  title: 'Inputs/ServiceSearch',
  component: ServiceSearch,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The onboarding wrapper around `ServiceSearchBase`, used while a practice is still ' +
          'choosing its specialities and nothing has been saved. Rather than writing to the API ' +
          "it updates the caller's `specialities` array in place: it finds the speciality by name, " +
          'refuses a service whose name is already there (case-insensitive), and otherwise appends ' +
          'a service built by `useOnboardingServiceBuilder` - the catalogue template for that ' +
          'speciality and business type when one matches, or a capitalised custom template when ' +
          'the name is new. Every other speciality in the array is returned untouched.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    speciality: DENTISTRY,
    setSpecialities: fn(),
  },
  render: (args) => <Harness speciality={args.speciality} />,
  beforeEach: withHospital,
} satisfies Meta<typeof ServiceSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: FIELD })).toHaveValue('');
    await expect(canvas.queryByLabelText(RESULTS)).not.toBeInTheDocument();
    await expect(
      within(canvas.getByRole('list', { name: 'Dentistry services' })).queryAllByRole('listitem')
    ).toHaveLength(0);
  },
};

export const DropdownOpen: Story = {
  name: 'Dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(results.getByRole('button', { name: 'General Consult' })).toBeInTheDocument();
    await expect(
      results.getByRole('button', { name: 'Dental Cleaning & Scaling' })
    ).toBeInTheDocument();
  },
};

export const PickFromCatalogue: Story = {
  name: 'Pick from the catalogue',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.click(canvas.getByRole('button', { name: 'Tooth Extraction' }));

    const chips = within(canvas.getByRole('list', { name: 'Dentistry services' }));
    await expect(chips.getByText('Tooth Extraction')).toBeInTheDocument();
    await expect(chips.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.queryByLabelText(RESULTS)).not.toBeInTheDocument();
    await expect(field).toHaveValue('');
    // The other speciality in the array is returned as it was.
    await expect(canvas.getByText('Cardiology services: 1')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A catalogue pick appends the templated service (duration and cost from the onboarding ' +
          'catalogue) to the matching speciality only. Cardiology, sitting next to it in the same ' +
          'array, keeps its one service.',
      },
    },
  },
};

export const CreateCustom: Story = {
  name: 'Create a custom service',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.type(field, 'feline dental radiographs');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Add service “feline dental radiographs”' })
    );

    const chips = within(canvas.getByRole('list', { name: 'Dentistry services' }));
    // Capitalised by the custom template the builder falls back to.
    await expect(chips.getByText('Feline dental radiographs')).toBeInTheDocument();
    await expect(field).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A name the catalogue does not know becomes a custom service with the first letter ' +
          'capitalised and the organisation stamped on it, so it saves cleanly when onboarding ' +
          'submits the whole array.',
      },
    },
  },
};

export const AlreadyAdded: Story = {
  name: 'Existing services hidden, duplicates refused',
  args: {
    speciality: {
      ...DENTISTRY,
      services: [
        service('Dental Cleaning & Scaling', 'speciality-dentistry'),
        service('Tooth Extraction', 'speciality-dentistry'),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    const chips = within(canvas.getByRole('list', { name: 'Dentistry services' }));
    await expect(chips.getAllByRole('listitem')).toHaveLength(2);

    await userEvent.click(field);
    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(
      results.queryByRole('button', { name: 'Tooth Extraction' })
    ).not.toBeInTheDocument();

    // Typing an existing name in a different case falls through to the create
    // row, and the wrapper still refuses it.
    await userEvent.type(field, 'tooth extraction');
    await userEvent.click(canvas.getByRole('button', { name: 'Add service “tooth extraction”' }));
    await expect(chips.getAllByRole('listitem')).toHaveLength(2);
    await expect(field).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two services already chosen. The dropdown hides them, and the create row (reached by ' +
          'typing one of them in lower case) is refused by the name check in the wrapper, so the ' +
          'chip count stays at two.',
      },
    },
  },
};
