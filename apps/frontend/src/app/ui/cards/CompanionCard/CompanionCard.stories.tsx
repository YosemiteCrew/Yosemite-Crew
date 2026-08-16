import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import CompanionCard from './CompanionCard';

const parent: CompanionParent['parent'] = {
  id: 'parent-1',
  firstName: 'Marta',
  lastName: 'Alvarez',
  email: 'marta.alvarez@example.com',
  phoneNumber: '+34 600 000 000',
  address: { city: 'Barcelona', country: 'ES' },
  createdFrom: 'pms',
};

const baseCompanion: CompanionParent = {
  companion: {
    id: 'companion-1',
    organisationId: 'org-1',
    parentId: 'parent-1',
    name: 'Kiko',
    type: 'dog',
    breed: 'Border Collie',
    dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
    gender: 'male',
    allergy: 'Chicken protein',
    isInsured: true,
    status: 'active',
  },
  parent,
};

const meta = {
  title: 'Cards/CompanionCard',
  component: CompanionCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone/tablet card for one companion record: avatar, breed and species, parent, ' +
          'gender/age, allergies, status pill, and a row of round icon actions. Each action is ' +
          'permission-gated, so the same card renders with anywhere from one to four buttons. ' +
          'Action labels run through the org terminology rewriter, which falls back to the ' +
          'default "companion" wording when no org is loaded.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companion: baseCompanion,
    handleViewCompanion: fn(),
    handleBookAppointment: fn(),
    handleAddTask: fn(),
    handleChangeStatus: fn(),
    canEditAppointments: true,
    canEditTasks: true,
    canEditCompanions: true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllActions: Story = { name: 'All actions' };

export const ViewOnly: Story = {
  name: 'View only (no edit permissions)',
  args: {
    canEditAppointments: false,
    canEditTasks: false,
    canEditCompanions: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A read-only member sees the single View action. The row stays centred rather than ' +
          'leaving three empty slots.',
      },
    },
  },
};

export const Archived: Story = {
  args: {
    companion: {
      ...baseCompanion,
      companion: {
        ...baseCompanion.companion,
        id: 'companion-2',
        name: 'Pepper',
        type: 'cat',
        breed: 'Maine Coon',
        gender: 'female',
        allergy: undefined,
        status: 'archived',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Archived tone on the status pill, and a missing allergy renders the `-` placeholder ' +
          'rather than an empty gap.',
      },
    },
  },
};

export const LongText: Story = {
  name: 'Long name and breed',
  args: {
    companion: {
      ...baseCompanion,
      companion: {
        ...baseCompanion.companion,
        id: 'companion-3',
        name: 'Bartholomew Wigglesworth III',
        type: 'horse',
        breed: 'Andalusian Cross Warmblood',
        allergy: 'Seasonal pollen, dust mites and one specific brand of hay net',
      },
      parent: { ...parent, lastName: 'Van Der Berg-Christiansen' },
    },
  },
};
