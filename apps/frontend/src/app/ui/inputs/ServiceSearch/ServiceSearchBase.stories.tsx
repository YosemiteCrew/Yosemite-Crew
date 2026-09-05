import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Service } from '@yosemite-crew/types';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';

import ServiceSearchBase from './ServiceSearchBase';

const ORG_ID = 'org-meadowbrook';
const FIELD = 'Search or create service';
const RESULTS = 'Service results';

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
  title: 'Inputs/ServiceSearchBase',
  component: ServiceSearchBase,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The presentational half of the service picker. It draws the search field, filters the ' +
          'built-in catalogue for the given speciality (`specialtiesByKey`), hides any service the ' +
          'speciality already carries, and collapses to a single "Add service" row when nothing ' +
          'matches. It owns no data: picking calls `onSelectService(name)`, creating calls ' +
          '`onAddService(name)` with the trimmed but otherwise untouched text, and the wrappers ' +
          '(`ServiceSearch` for onboarding, `ServiceSearchEdit` for an existing speciality) decide ' +
          'what to build from that. The dropdown closes on outside click and after either action, ' +
          'and the query is cleared with it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    speciality: DENTISTRY,
    onSelectService: fn(),
    onAddService: fn(),
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
} satisfies Meta<typeof ServiceSearchBase>;

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
    // "General Consult" is prepended for every consult-flagged speciality, then
    // the five dentistry services in catalogue order.
    await expect(results.getAllByRole('button')).toHaveLength(6);
    await expect(results.getByRole('button', { name: 'General Consult' })).toBeInTheDocument();
    await expect(
      results.getByRole('button', { name: 'Dental Cleaning & Scaling' })
    ).toBeInTheDocument();
    await expect(
      results.getByRole('button', { name: 'Bad Breath Evaluation' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Focus opens the full catalogue for the speciality, general consult first. The panel is ' +
          '`--screen` on a hairline with a 200px scroll cap.',
      },
    },
  },
};

export const PickFromCatalogue: Story = {
  name: 'Pick from the catalogue',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.click(canvas.getByRole('button', { name: 'Oral X-Rays' }));

    await expect(args.onSelectService).toHaveBeenCalledWith('Oral X-Rays');
    await expect(args.onAddService).not.toHaveBeenCalled();
    await expect(canvas.queryByLabelText(RESULTS)).not.toBeInTheDocument();
    await expect(field).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A catalogue row hands the exact catalogue name to `onSelectService`, then the dropdown ' +
          'closes and the field resets, ready for the next service.',
      },
    },
  },
};

export const CreateCustom: Story = {
  name: 'No match (create)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: FIELD });
    await userEvent.click(field);
    await userEvent.type(field, '  feline dental radiographs ');

    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(results.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(
      results.getByRole('button', { name: 'Add service “feline dental radiographs”' })
    );

    // Trimmed, not capitalised: the wrapper's builder decides the stored casing.
    await expect(args.onAddService).toHaveBeenCalledWith('feline dental radiographs');
    await expect(args.onSelectService).not.toHaveBeenCalled();
    await expect(field).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing something outside the catalogue replaces the list with one create row that ' +
          'quotes the trimmed text back. The base component passes that text through as typed; ' +
          "capitalisation is the caller's job.",
      },
    },
  },
};

export const ExistingFilteredOut: Story = {
  name: 'Existing services hidden',
  args: {
    speciality: {
      ...DENTISTRY,
      services: [service('Dental Cleaning & Scaling'), service('Tooth Extraction')],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    const results = within(await canvas.findByLabelText(RESULTS));
    await expect(results.getAllByRole('button')).toHaveLength(4);
    await expect(
      results.queryByRole('button', { name: 'Dental Cleaning & Scaling' })
    ).not.toBeInTheDocument();
    await expect(
      results.queryByRole('button', { name: 'Tooth Extraction' })
    ).not.toBeInTheDocument();
    await expect(
      results.getByRole('button', { name: 'Gum Disease Treatment' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two services already on the speciality. They are matched case-insensitively by name ' +
          'and dropped from the list, so the field cannot offer a duplicate.',
      },
    },
  },
};

export const OffCatalogueSpeciality: Story = {
  name: 'Speciality outside the catalogue',
  args: {
    speciality: { ...DENTISTRY, _id: 'speciality-exotics', name: 'Exotic animal medicine' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: FIELD }));
    const results = within(await canvas.findByLabelText(RESULTS));
    // No suggestions exist, so focus lands straight on the create row - which
    // quotes an empty name until something is typed.
    await expect(results.getAllByRole('button')).toHaveLength(1);
    await expect(results.getByRole('button', { name: 'Add service “”' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A speciality the practice created itself has no catalogue entry, so there is nothing ' +
          'to list and the dropdown opens on the create row with an empty quote. Worth knowing ' +
          'before it is mistaken for a bug: `handleAdd` refuses an empty name, so the row is inert ' +
          'until the reader types.',
      },
    },
  },
};
