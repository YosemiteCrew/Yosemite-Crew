import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Service } from '@yosemite-crew/types';

import type { SpecialityWeb } from '../../../features/organization/types/speciality';
import SpecialitiesCard from './index';

const service = (name: string, id: string): Service => ({
  id,
  organisationId: 'org-1',
  name,
  durationMinutes: 30,
  cost: 60,
  isActive: true,
});

const CARDIOLOGY: SpecialityWeb = {
  _id: 'spec-cardiology',
  organisationId: 'org-1',
  name: 'Cardiology',
  headName: 'Dr. Emily Carter',
  teamMemberIds: ['u-1', 'u-2', 'u-3'],
  services: [service('Echocardiogram', 'svc-1'), service('Cardiac consult', 'svc-2')],
};

const meta = {
  title: 'Cards/SpecialitiesCard',
  component: SpecialitiesCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The tile in the organisation's specialities grid. It is a summary, not an editor: the " +
          'speciality name, the services rolled up into one comma-joined line, the assigned head-count ' +
          'and the head of department, with a full-width `Secondary` button that hands the speciality ' +
          'back to the page so it can open the detail drawer.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    speciality: CARDIOLOGY,
    handleViewSpeciality: fn(),
  },
} satisfies Meta<typeof SpecialitiesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One column of the grid. The tile has no width of its own, so the single-card
 * stories supply the ~300px track the specialities page gives it.
 */
const inOneColumn: NonNullable<Story['decorators']> = (StoryFn) => (
  <div style={{ maxWidth: 300 }}>
    <StoryFn />
  </div>
);

export const Default: Story = { decorators: [inOneColumn] };

/**
 * What a speciality looks like the day it is created: no services attached, no
 * team assigned and no head named. Every label still renders, so the card keeps
 * its height and the grid stays on a single row rhythm - the values are simply
 * blank, which is the state worth watching for a stray "undefined".
 */
export const Empty: Story = {
  name: 'Newly created (no services or team)',
  decorators: [inOneColumn],
  args: {
    speciality: {
      _id: 'spec-new',
      organisationId: 'org-1',
      name: 'Rehabilitation',
    },
  },
};

export const LongContent: Story = {
  name: 'Long name and service list',
  decorators: [inOneColumn],
  args: {
    speciality: {
      _id: 'spec-internal-medicine',
      organisationId: 'org-1',
      name: 'Internal Medicine & Critical Care',
      headName: 'Dr. Alexandra Fitzgerald-Whitmore',
      teamMemberIds: Array.from({ length: 12 }, (_, index) => `u-${index}`),
      services: [
        service('Endoscopy', 'svc-3'),
        service('Ultrasound diagnostics', 'svc-4'),
        service('Intensive care monitoring', 'svc-5'),
        service('Blood transfusion', 'svc-6'),
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case. Nothing in the card truncates, so a long service list wraps and pushes ' +
          'the button down - in a grid of equal-height tiles that is what makes one row taller than ' +
          'the rest.',
      },
    },
  },
};

/**
 * How the cards actually read on the specialities page: a responsive grid where
 * uneven content lengths have to sit next to each other.
 */
export const InGrid: StoryObj = {
  name: 'In the specialities grid',
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SpecialitiesCard speciality={CARDIOLOGY} handleViewSpeciality={fn()} />
      <SpecialitiesCard
        speciality={{
          _id: 'spec-dermatology',
          organisationId: 'org-1',
          name: 'Dermatology',
          headName: 'Dr. Nils Berg',
          teamMemberIds: ['u-4'],
          services: [service('Allergy testing', 'svc-7')],
        }}
        handleViewSpeciality={fn()}
      />
      <SpecialitiesCard
        speciality={{
          _id: 'spec-oncology',
          organisationId: 'org-1',
          name: 'Oncology',
          headName: 'Dr. Priya Raman',
          teamMemberIds: ['u-5', 'u-6'],
          services: [service('Chemotherapy', 'svc-8'), service('Tumour staging', 'svc-9')],
        }}
        handleViewSpeciality={fn()}
      />
    </div>
  ),
};
