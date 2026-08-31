import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SpecialitiesTable from './SpecialitiesTable';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';

const ORG_ID = 'org-specialities-table-story';

const service = (name: string, index: number) =>
  ({
    _id: `service-${index}`,
    name,
    organisationId: ORG_ID,
  }) as NonNullable<SpecialityWeb['services']>[number];

const speciality = (
  index: number,
  name: string,
  serviceNames: string[],
  description?: string
): SpecialityWeb =>
  ({
    _id: `speciality-${index}`,
    organisationId: ORG_ID,
    name,
    description,
    services: serviceNames.map((serviceName, i) => service(serviceName, index * 10 + i)),
  }) as SpecialityWeb;

const SPECIALITIES: SpecialityWeb[] = [
  speciality(1, 'General practice', ['Annual health check', 'Vaccination', 'Microchipping']),
  speciality(2, 'Dentistry', ['Scale and polish', 'Extraction', 'Dental radiography']),
  speciality(3, 'Orthopaedics', ['Lameness workup', 'Cruciate repair']),
  speciality(4, 'Dermatology', ['Allergy testing', 'Skin cytology', 'Otoscopy']),
  speciality(5, 'Diagnostic imaging', ['Radiography', 'Ultrasound', 'CT referral']),
];

const meta = {
  title: 'Tables/SpecialitiesTable',
  component: SpecialitiesTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The practice's speciality list, with the services each one offers joined into one " +
          'clamped cell. The clamp is the point: a speciality with eight services would otherwise ' +
          'stand several lines taller than its neighbours and break the row rhythm. Below the ' +
          'breakpoint the rows become `SpecialitiesCard`s.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: SPECIALITIES,
    setActive: fn(),
    setView: fn(),
  },
} satisfies Meta<typeof SpecialitiesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Five specialities',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('General practice').length).toBeGreaterThan(0);
    // The services cell is a joined list, not one name.
    await expect(canvas.getAllByText(/Annual health check/).length).toBeGreaterThan(0);
  },
};

export const OpensASpeciality: Story = {
  name: 'Viewing a speciality',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole('button')[0]);
    await expect(args.setActive).toHaveBeenCalledTimes(1);
    await expect(args.setView).toHaveBeenCalledWith(true);
  },
};

export const NoServices: Story = {
  name: 'A speciality with no services yet',
  args: {
    filteredList: [speciality(9, 'Behaviour', []), ...SPECIALITIES],
  },
  play: async ({ canvasElement }) => {
    /* An em dash, not an empty cell: a blank looks like a rendering failure,
       while the dash says the speciality genuinely has nothing attached. */
    await expect(within(canvasElement).getAllByText('—').length).toBeGreaterThan(0);
  },
};

export const ManyServices: Story = {
  name: 'A speciality with a long service list',
  args: {
    filteredList: [
      speciality(8, 'Internal medicine', [
        'Endoscopy',
        'Bronchoscopy',
        'Rhinoscopy',
        'Cystoscopy',
        'Bone marrow aspirate',
        'Blood pressure monitoring',
        'Ultrasound-guided biopsy',
      ]),
      ...SPECIALITIES,
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Seven services in the cell that is meant to clamp. The row must stay the same height ' +
          'as its neighbours and carry the full list in a title attribute rather than wrapping.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No specialities configured',
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    /* Exact text: Storybook's preview decorator renders the story name in an
       sr-only h1, so a loose /no /i matches that too. */
    await expect(within(canvasElement).getByText('No data available')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
