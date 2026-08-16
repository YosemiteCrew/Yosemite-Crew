import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Speciality } from '@yosemite-crew/types';

import SpecialityCard from './SpecialityCard';

const speciality = (name: string): Speciality => ({
  _id: name.toLowerCase().replaceAll(/\s+/g, '-'),
  organisationId: 'org-1',
  name,
});

const meta = {
  title: 'Cards/SpecialityCard',
  component: SpecialityCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "One row in the organisation's speciality list: a hairline card holding the speciality name " +
          'and a trash affordance that drops it from the working list. It is a purely local editor — ' +
          'it calls `setSpecialities` and nothing else, so nothing is persisted until the surrounding ' +
          'form is saved.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    speciality: speciality('Cardiology'),
    setSpecialities: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 520 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof SpecialityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * The card is a fixed 48px band, so a long speciality name has to sit on one
 * line beside the trash icon. This is the case that shows whether the name
 * crowds the affordance.
 */
export const LongName: Story = {
  name: 'Long name',
  args: { speciality: speciality('Anesthesiology & Pain Management') },
};

/**
 * How the list actually reads — several cards stacked, with delete wired to
 * real state so removing one is visible.
 */
const SpecialityList = () => {
  const [specialities, setSpecialities] = useState<Speciality[]>([
    speciality('Cardiology'),
    speciality('Dermatology'),
    speciality('Emergency & Critical Care'),
  ]);

  return (
    <div className="flex flex-col gap-2">
      {specialities.map((item) => (
        <SpecialityCard key={item.name} speciality={item} setSpecialities={setSpecialities} />
      ))}
    </div>
  );
};

export const List: Story = {
  render: () => <SpecialityList />,
};
