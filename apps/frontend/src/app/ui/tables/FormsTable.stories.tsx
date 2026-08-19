import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { FormsProps } from '@/app/features/forms/types/forms';
import FormsTable from './FormsTable';

const SERVICE_OPTIONS = [
  { label: 'Skin & coat examination', value: 'svc-skin' },
  { label: 'Anal Gland Expression', value: 'svc-glands' },
  { label: 'Testing Service', value: 'svc-testing' },
];

const template = (over: Partial<FormsProps>): FormsProps =>
  ({
    _id: 'tpl-1',
    name: 'Consent general practice',
    description: 'Consent form for general practice visits',
    category: 'Consent form',
    usage: 'Appointment',
    updatedBy: 'Tim Apple',
    lastUpdated: '2026-07-18T09:00:00.000Z',
    status: 'PUBLISHED',
    schema: [],
    services: [],
    ...over,
  }) as FormsProps;

const ROWS: FormsProps[] = [
  template({ _id: 'tpl-1', services: ['svc-skin'] }),
  template({
    _id: 'tpl-2',
    name: 'Prescription skin',
    description: 'sample desc skin medicine',
    category: 'Prescription',
    services: ['svc-skin', 'svc-glands'],
  }),
  template({
    _id: 'tpl-3',
    name: 'SOAP - General Consult',
    description: 'Clinical note',
    category: 'SOAP',
    services: ['6970cb292a9f903dd2935813'],
    status: 'DRAFT',
  }),
  template({
    _id: 'tpl-4',
    name: 'Discharge Form',
    description: 'Discharge',
    category: 'Discharge Form',
    services: [],
    status: 'ARCHIVED',
  }),
];

const meta = {
  title: 'Tables/FormsTable',
  component: FormsTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Templates list. `showLinkedServices` opts into the chips column, which resolves ' +
          "each template's `services` ids through `serviceOptions`.\n\n" +
          'That resolution is the reason this file exists. An id with no matching option - a ' +
          'service that was deleted, or that belongs to another organisation - used to fall ' +
          'back to rendering the id itself, so the live Templates page showed rows of ' +
          '24-character ObjectIDs where a service name belongs. The third row below carries ' +
          'exactly that: one resolvable service and one dangling id. The id is an internal ' +
          'identifier and means nothing to the reader, so it is not shown at all now.\n\n' +
          'The actions column was also 64px, which fitted its `...` button but not its own ' +
          'header - the column read "ACTIO…". It is 88px.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: ROWS,
    setActiveForm: fn(),
    setViewPopup: fn(),
    showLinkedServices: true,
    serviceOptions: SERVICE_OPTIONS,
  },
} satisfies Meta<typeof FormsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Templates list',
};

export const DanglingService: Story = {
  name: 'Linked service that no longer resolves',
  args: { filteredList: [ROWS[2]] },
  parameters: {
    docs: {
      story:
        'The regression guard. `serviceOptions` has no entry for this id, so the chip has to ' +
        'read as unavailable rather than printing the identifier.',
    },
  },
};

export const WithoutLinkedServices: Story = {
  name: 'Column off (other callers)',
  args: { showLinkedServices: false, serviceOptions: undefined },
  parameters: {
    docs: {
      story:
        'The table is shared. With the opt-in off the columns are exactly what every other ' +
        'caller renders.',
    },
  },
};

export const Loading: Story = {
  args: { filteredList: [], loading: true },
};

export const Empty: Story = {
  args: { filteredList: [] },
};
