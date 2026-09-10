import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { CompanionSelect, type CompanionSelectOption } from './CompanionSelect';

const companions: CompanionSelectOption[] = [
  { id: 'c1', name: 'Bella', ownerName: 'Maria Chen' },
  { id: 'c2', name: 'Rocky', ownerName: 'James Okafor' },
  { id: 'c3', name: 'Whiskers', ownerName: 'Priya Nair' },
];

const companionSelectMeta = {
  title: 'Appointments/CompanionSelect',
  component: CompanionSelect,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The companion picker shared by the appointment panels that put a patient on a list ' +
          '(the waitlist and the check-in board). Each panel names the same control differently - ' +
          '"Companion" on the waitlist, "Patient" at the front desk - so the wording is passed in as ' +
          'props while the markup stays one definition: a searchable LabelDropdown, not a native ' +
          '`<select>` (whose open option list is unstyleable browser chrome). The control disables ' +
          'itself and swaps the placeholder for `emptyLabel` when `companions` is empty, and appends ' +
          'the owner name to an option only when a companion has one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Companion',
    placeholder: 'Select a companion',
    emptyLabel: 'No companions available',
    value: '',
    onChange: fn(),
    companions,
  },
} satisfies Meta<typeof CompanionSelect>;

export default companionSelectMeta;
type CompanionSelectStory = StoryObj<typeof companionSelectMeta>;

export const Default: CompanionSelectStory = {};

export const Selected: CompanionSelectStory = {
  args: { value: 'c2' },
};

export const Empty: CompanionSelectStory = {
  name: 'No companions to pick',
  args: { companions: [], value: '' },
};

export const WithoutOwnerNames: CompanionSelectStory = {
  name: 'Companions without an owner on file',
  args: {
    companions: [
      { id: 'c1', name: 'Bella' },
      { id: 'c2', name: 'Rocky' },
    ],
  },
};

export const CheckInWording: CompanionSelectStory = {
  name: 'Reused at the check-in board',
  args: {
    label: 'Patient',
    placeholder: 'Select a patient',
    emptyLabel: 'No patients waiting',
  },
};
