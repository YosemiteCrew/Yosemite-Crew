import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import type { Service } from '@yosemite-crew/types';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';

import ServiceSearchEdit from './ServiceSearchEdit';

const ORG_ID = 'org-storybook';

const service = (name: string): Service => ({
  id: name.toLowerCase().replaceAll(/\W+/g, '-'),
  organisationId: ORG_ID,
  name,
  durationMinutes: 30,
  cost: 60,
  specialityId: 'speciality-dentistry',
  isActive: true,
});

const DENTISTRY: SpecialityWeb = {
  _id: 'speciality-dentistry',
  organisationId: ORG_ID,
  name: 'Dentistry',
  services: [],
};

const meta = {
  title: 'Inputs/ServiceSearchEdit',
  component: ServiceSearchEdit,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The add-a-service field on an existing speciality. It offers the built-in catalogue for ' +
          'that speciality, hides services the speciality already has, and falls back to a create row ' +
          'when nothing matches. Picking or creating a service writes it straight through to the API, ' +
          'so these stories stop at the open dropdown and never commit a selection.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    speciality: DENTISTRY,
  },
  decorators: [
    // The dropdown is absolutely positioned under the field, so the frame needs
    // room below it or the open state is clipped out of the snapshot.
    (StoryFn) => (
      <div style={{ width: 340, paddingBottom: 300 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof ServiceSearchEdit>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state — just the search field. */
export const Default: Story = { name: 'Closed' };

/** Focusing the field lists every catalogue service for the speciality. */
export const DropdownOpen: Story = {
  name: 'Dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: /search or create service/i }));
  },
};

/**
 * Services the speciality already carries are filtered out, so the list shrinks
 * as the speciality fills up rather than offering duplicates.
 */
export const AlreadyAdded: Story = {
  name: 'Existing services filtered out',
  args: {
    speciality: {
      ...DENTISTRY,
      services: [service('Dental Cleaning & Scaling'), service('Tooth Extraction')],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: /search or create service/i }));
  },
};

/**
 * No catalogue match — the dropdown collapses to a single create row that
 * quotes the typed name back. The name is capitalised on save.
 */
export const CreateNew: Story = {
  name: 'No match (create)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: /search or create service/i });
    await userEvent.click(input);
    await userEvent.type(input, 'feline dental radiographs');
  },
};
