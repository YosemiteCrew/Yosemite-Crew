import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import InsuranceClaimFormFields, { type CompanionChoice } from './InsuranceClaimFormFields';
import type { ClaimDraft } from './useInsuranceClaimDraft';

const emptyDraft: ClaimDraft = {
  patientId: '',
  insurerName: '',
  policyNumber: '',
  submittedAmount: '',
  invoiceId: '',
  encounterId: '',
  notes: '',
};

const filledDraft: ClaimDraft = {
  patientId: 'companion-bramble',
  insurerName: 'Trupanion',
  policyNumber: 'TRU-88213-UK',
  submittedAmount: '412.50',
  invoiceId: 'inv-2291',
  encounterId: 'enc-7734',
  notes: 'Follow-up dental cleaning after the July extraction; owner asked for itemised receipt.',
};

const companions: CompanionChoice[] = [
  { id: 'companion-bramble', name: 'Bramble' },
  { id: 'companion-otis', name: 'Otis' },
  { id: 'companion-willow', name: 'Willow' },
];

const insuranceClaimFormFieldsMeta = {
  title: 'InsuranceClaims/InsuranceClaimFormFields',
  component: InsuranceClaimFormFields,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The insurance claim create form's fields: a companion picker, the insurer's name " +
          'and policy number, the submitted amount labelled with the org currency symbol, and ' +
          'two optional free-text links - invoice ID and encounter ID - plus optional notes. ' +
          'The invoice and encounter fields are free text rather than pickers because a claim ' +
          'can be filed before either record exists.\n\n' +
          'Presentational: every field is controlled from `draft` and reports changes through ' +
          '`setField` with a partial patch. The draft state, its validation and the payload it ' +
          'builds all live in `useInsuranceClaimDraft`, not here.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    currency: {
      control: 'select',
      options: ['USD', 'GBP', 'EUR', 'INR'],
    },
  },
  args: {
    draft: emptyDraft,
    setField: fn(),
    currency: 'USD',
    companions,
  },
} satisfies Meta<typeof InsuranceClaimFormFields>;

export default insuranceClaimFormFieldsMeta;
type InsuranceClaimFormFieldsStory = StoryObj<typeof insuranceClaimFormFieldsMeta>;

export const Default: InsuranceClaimFormFieldsStory = {};

export const Filled: InsuranceClaimFormFieldsStory = {
  name: 'Filled-in claim',
  args: {
    draft: filledDraft,
  },
};

export const NoCompanions: InsuranceClaimFormFieldsStory = {
  name: 'No companions to choose from',
  args: {
    companions: [],
  },
};

export const IndianRupeeCurrency: InsuranceClaimFormFieldsStory = {
  name: 'Non-USD currency (INR)',
  args: {
    draft: { ...emptyDraft, patientId: 'companion-otis', submittedAmount: '18500' },
    currency: 'INR',
  },
};
