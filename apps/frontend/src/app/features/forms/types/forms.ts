import type {
  FieldOption,
  FieldType,
  Form as BackendForm,
  FormField as BackendFormField,
  Organisation,
} from '@yosemite-crew/types';

const formsCategories = [
  'Consent form',
  'Prescription',
  'SOAP',
  'Discharge Form',
  'Boarder - Boarding Checklist',
  'Boarder - Dietary Plan',
  'Boarder - Medication Details',
  'Boarder - Daily Summary',
  'Boarder - Schedule',
  'Boarder - Belongings',
  'Breeder - Health & Behavior',
  'Breeder - Mating Log',
  'Breeder - Consultation & Planning',
  'Breeder - Mating & Fertility Preferences',
  'Breeder - Belongings',
  'Breeder - Check-in',
  'Breeder - Pregnancy Care',
  'Breeder - Health Summary',
  'Groomer - Service Request & Preferences',
  'Groomer - Grooming Prep',
  'Groomer - Bathing & Cleaning Worklog',
  'Groomer - Haircut / Styling Worklog',
  'Groomer - Spa Add-ons Worklog',
  'Groomer - Health Requirements',
  'Custom',
] as const;

export type FormsCategory = (typeof formsCategories)[number];
export const FormsCategoryOptions: FormsCategory[] = [...formsCategories];

export const getFormCategoryDisplayLabel = (
  category: string,
  _orgType?: Organisation['type']
): string => category;

const formsUsageOptions = ['Internal', 'External', 'Internal & External'] as const;

export type FormsUsage = (typeof formsUsageOptions)[number];
export const FormsUsageOptions: FormsUsage[] = [...formsUsageOptions];

const formsStatuses = ['Published', 'Draft', 'Archived'] as const;

export type FormsStatus = (typeof formsStatuses)[number];
export const FormsStatusFilters: Array<FormsStatus | 'All'> = ['All', ...formsStatuses];

export type FormFieldType = FieldType;

export type FormField = BackendFormField & {
  defaultValue?: any;
};

export type RequiredSigner = BackendForm['requiredSigner'];
export type RequiredSignerValue = 'CLIENT' | 'VET' | '';

export const RequiredSignerOptions: Array<{
  label: string;
  value: RequiredSignerValue;
}> = [
  { label: 'No signature required', value: '' },
  { label: 'Pet parent', value: 'CLIENT' },
  { label: 'Service provider', value: 'VET' },
];

export const requiredSignerLabel = (value?: RequiredSignerValue): string => {
  if (value === '') return 'No signature required';
  if (value === 'CLIENT') return 'Pet parent';
  if (value === 'VET') return 'Service provider';
  return '';
};

export type FormsProps = {
  _id?: string;
  orgId?: string;
  name: string;
  description?: string;
  services?: string[];
  species?: string[];
  category: FormsCategory;
  usage: FormsUsage;
  requiredSigner?: RequiredSignerValue;
  businessType?: Organisation['type'];
  updatedBy: string;
  lastUpdated: string;
  status?: FormsStatus;
  schema: FormField[];
};

const makeOption = (label: string, value?: string): FieldOption => ({
  label,
  value: value ?? label,
});

const YES_NO_OPTIONS: FieldOption[] = [makeOption('Yes', 'yes'), makeOption('No', 'no')];

const FREQUENCY_OPTIONS: FieldOption[] = [
  makeOption('1x daily', '1x_daily'),
  makeOption('2x daily', '2x_daily'),
  makeOption('3x daily', '3x_daily'),
  makeOption('On-demand', 'on_demand'),
];

const APPETITE_STATUS_OPTIONS: FieldOption[] = [
  makeOption('Strong appetite', 'strong_appetite'),
  makeOption('Picky appetite', 'picky_appetite'),
  makeOption('Increased appetite', 'increased_appetite'),
  makeOption('Normal appetite', 'normal_appetite'),
  makeOption('Poor appetite', 'poor_appetite'),
  makeOption('Not eating', 'not_eating'),
];

const BEHAVIOR_STATUS_OPTIONS: FieldOption[] = [
  makeOption('Friendly', 'friendly'),
  makeOption('Nervous', 'nervous'),
  makeOption('Aggressive', 'aggressive'),
  makeOption('Alert', 'alert'),
  makeOption('Defensive', 'defensive'),
  makeOption('Highly anxious', 'highly_anxious'),
];

type PresetOptions = 'yesNo' | 'frequency' | 'appetite' | 'behavior';

const PRESET_OPTIONS: Record<PresetOptions, FieldOption[]> = {
  yesNo: YES_NO_OPTIONS,
  frequency: FREQUENCY_OPTIONS,
  appetite: APPETITE_STATUS_OPTIONS,
  behavior: BEHAVIOR_STATUS_OPTIONS,
};

const createField = (
  id: string,
  label: string,
  type: FormField['type'],
  options?: FieldOption[] | PresetOptions,
  extra?: Partial<FormField>
): FormField => {
  const field: Record<string, unknown> = { id, type, label };
  if (options) {
    field.options = typeof options === 'string' ? PRESET_OPTIONS[options] : options;
  }
  return { ...field, ...extra } as FormField;
};

const yesNoRadio = (id: string, label: string): FormField =>
  createField(id, label, 'radio', 'yesNo');

const frequencyRadio = (id: string, label: string): FormField =>
  createField(id, label, 'radio', 'frequency');

const appetiteStatusRadio = (id: string, label: string): FormField =>
  createField(id, label, 'radio', 'appetite');

const behaviorStatusCheckbox = (id: string, label: string): FormField =>
  createField(id, label, 'checkbox', 'behavior', { multiple: true });

const textInputField = (
  id: string,
  label: string,
  placeholder = '',
  extra?: Partial<FormField>
): FormField => createField(id, label, 'input', undefined, { placeholder, ...extra });

const numberField = (
  id: string,
  label: string,
  placeholder = '',
  extra?: Partial<FormField>
): FormField => createField(id, label, 'number', undefined, { placeholder, ...extra });

const textAreaField = (
  id: string,
  label: string,
  placeholder = '',
  extra?: Partial<FormField>
): FormField => createField(id, label, 'textarea', undefined, { placeholder, ...extra });

const dateField = (
  id: string,
  label: string,
  placeholder = '',
  extra?: Partial<FormField>
): FormField => createField(id, label, 'date', undefined, { placeholder, ...extra });

const checkboxField = (
  id: string,
  label: string,
  options: FieldOption[],
  extra?: Partial<FormField>
): FormField => createField(id, label, 'checkbox', options, { multiple: true, ...extra });

const radioField = (
  id: string,
  label: string,
  options: FieldOption[],
  extra?: Partial<FormField>
): FormField => createField(id, label, 'radio', options, extra);

const groupField = (
  id: string,
  label: string,
  fields: FormField[],
  extra?: Partial<FormField>
): FormField => createField(id, label, 'group', undefined, { fields, ...extra });

const signatureField = (id: string, label: string, extra?: Partial<FormField>): FormField =>
  createField(id, label, 'signature', undefined, extra);

const buildYesNoFieldList = (fields: Array<readonly [id: string, label: string]>): FormField[] =>
  fields.map(([id, label]) => yesNoRadio(id, label));

const buildTextAreaFieldList = (
  fields: Array<readonly [id: string, label: string, placeholder?: string]>
): FormField[] =>
  fields.map(([id, label, placeholder = '']) => textAreaField(id, label, placeholder));

const buildTextInputFieldList = (
  fields: Array<readonly [id: string, label: string, placeholder?: string]>
): FormField[] =>
  fields.map(([id, label, placeholder = '']) => textInputField(id, label, placeholder));

export const medicationRouteOptions = [
  'Oral',
  'Topical',
  'Injectable',
  'Rectal',
  'Ophthalmic',
  'Inhalation',
  'Otic',
  'Sublingual',
  'Buccal',
  'Intranasal',
  'IV',
  'IM',
  'SC',
].map((label) => makeOption(label));

export const buildMedicationFields = (prefix: string, separator: '_' | '-' = '_'): FormField[] => {
  const join = (key: string) => `${prefix}${separator}${key}`;
  return [
    {
      id: join('name'),
      type: 'input',
      label: 'Name',
      placeholder: 'Enter medicine name',
    },
    {
      id: join('dosage'),
      type: 'input',
      label: 'Dosage',
      placeholder: 'Enter dosage',
    },
    {
      id: join('route'),
      type: 'dropdown',
      label: 'Route',
      options: medicationRouteOptions,
    },
    {
      id: join('frequency'),
      type: 'input',
      label: 'Frequency',
      placeholder: 'Enter frequency',
    },
    {
      id: join('duration'),
      type: 'input',
      label: 'Duration',
      placeholder: 'Enter duration',
    },
    {
      id: join('price'),
      type: 'number',
      label: 'Price',
      placeholder: '',
    },
    {
      id: join('remark'),
      type: 'textarea',
      label: 'Remark',
      placeholder: 'Add remark',
    },
  ];
};

const buildServicesGroup = (): FormField => ({
  id: 'services_group',
  type: 'group',
  label: 'Services',
  meta: { serviceGroup: true } as any,
  fields: [
    {
      id: 'services_group_services',
      type: 'checkbox',
      label: '', // Empty label to avoid duplicate "Services" text
      options: [],
      multiple: true,
    } as BackendFormField,
  ],
});

export const CategoryTemplates: Record<FormsCategory, FormField[]> = {
  Custom: [],
  'Consent form': [
    textInputField('pet_name', 'Companion name', 'Enter Companion name', { required: true }),
    textInputField('owner_name', 'Pet parent name', 'Enter pet parent name', { required: true }),
    textAreaField('procedure', 'Procedure / treatment', 'Describe the procedure and purpose', {
      required: true,
    }),
    textAreaField(
      'risks',
      'Risks discussed',
      'List key risks that were explained to the pet parent'
    ),
    checkboxField('consent_ack', 'Pet parent agrees to proceed', [
      makeOption('I have read and understood the above'),
    ]),
    signatureField('consent_signature', 'Pet parent signature', { required: true }),
  ],
  Prescription: [
    groupField('medications', 'Medications', [], { meta: { medicationGroup: true } as any }),
    buildServicesGroup(),
    textAreaField(
      'additional_notes',
      'Additional notes',
      'Add observations and pet parent instructions'
    ),
    textAreaField(
      'important_notes',
      'Important notes',
      'Highlight critical follow-up instructions'
    ),
    signatureField('signature', 'Signature'),
  ],
  SOAP: [
    groupField('subjective_section', 'Subjective', [
      textAreaField(
        'subjective_history',
        'Subjective (history)',
        'Describe presenting concerns and history',
        { required: true }
      ),
    ]),
    groupField('objective_section', 'Objective', [
      textAreaField('general_behavior', 'General behavior', 'General behavior notes'),
      groupField('vitals', 'Vitals', [
        numberField('temperature', 'Temperature'),
        textInputField('pulse', 'Pulse', 'Enter pulse'),
        numberField('respiration', 'Respiration'),
        textInputField('mucous_membrane_color', 'Mucous membrane color', 'Enter color'),
        textInputField('blood_pressure', 'Blood pressure', 'Enter blood pressure'),
        textInputField('body_weight', 'Body weight', 'Enter weight'),
        textInputField('hydration_status', 'Hydration status', 'Describe hydration'),
        textInputField('behavior_secondary', 'General behavior', 'Enter behavior'),
      ]),
      textAreaField('musculoskeletal_exam', 'Musculoskeletal Exam', 'Document findings'),
      textAreaField('neuro', 'Neuro', 'Document findings'),
      textAreaField('pain_score', 'Pain Score', 'Enter pain score details'),
    ]),
    groupField('assessment_section', 'Assessment', [
      textAreaField('tentative_diagnosis', 'Tentative diagnosis', 'Enter tentative diagnosis'),
      textAreaField(
        'differential_diagnosis',
        'Differential diagnosis',
        'List differential diagnoses'
      ),
      textAreaField('prognosis', 'Prognosis', 'Enter prognosis'),
    ]),
    groupField('treatment_plan', 'Plan', [
      textAreaField(
        'additional_notes',
        'Additional notes',
        'Add observations and pet parent instructions'
      ),
      textAreaField(
        'important_notes',
        'Important notes',
        'Highlight critical follow-up instructions'
      ),
    ]),
    signatureField('signature', 'Signature'),
  ],
  'Discharge Form': [
    groupField('discharge_section', 'Discharge summary', [
      textAreaField(
        'discharge_summary',
        'Discharge summary',
        'Summarize visit, findings and treatments provided.'
      ),
      textAreaField(
        'home_care',
        'Home care instructions',
        'Explain wound care, diet, activity restriction.'
      ),
      textAreaField(
        'discharge_medications',
        'Medications',
        'List medications, dosage, route, and schedule.'
      ),
      dateField('follow_up', 'Follow-up date', 'Select next visit date'),
    ]),
    signatureField('signature', 'Signature'),
  ],
  'Boarder - Boarding Checklist': [
    {
      id: 'temperature_and_pulse_records',
      type: 'group',
      label: 'Temperature and pulse records',
      fields: [
        { id: 'temp_readings', type: 'input', label: 'Temperature readings' },
        { id: 'pulse_monitoring', type: 'input', label: 'Pulse monitoring' },
        { id: 'respiration_rate', type: 'input', label: 'Respiration rate' },
      ],
    },
    {
      id: 'boarding_options',
      type: 'group',
      label: 'Boarding options',
      fields: [
        {
          id: 'day_boarding_services',
          type: 'checkbox',
          label: 'Day boarding services',
          multiple: true,
          options: [
            makeOption('Day care options', 'day_care_options'),
            makeOption('Overnight stay details', 'overnight_stay_details'),
            makeOption('Weekly boarding plans', 'weekly_boarding_plans'),
          ],
        },
        {
          id: 'overnight_boarding_services',
          type: 'radio',
          label: 'Overnight boarding services',
          options: [makeOption('Yes', 'yes'), makeOption('No', 'no')],
        },
        {
          id: 'long_term_boarding',
          type: 'radio',
          label: 'Long-term boarding options',
          options: [makeOption('Yes', 'yes'), makeOption('No', 'no')],
        },
        {
          id: 'special_needs_boarding',
          type: 'radio',
          label: 'Special needs boarding services',
          options: [makeOption('Yes', 'yes'), makeOption('No', 'no')],
        },
      ],
    },
    {
      id: 'additional_services',
      type: 'group',
      label: 'Additional services and monitoring',
      fields: [
        {
          id: 'cctv_live_updates',
          type: 'radio',
          label: 'CCTV and live updates',
          options: [makeOption('Yes', 'yes'), makeOption('No', 'no')],
        },
        {
          id: 'health_checks_during_stay',
          type: 'radio',
          label: 'Health checks during stay',
          options: [makeOption('Yes', 'yes'), makeOption('No', 'no')],
        },
        {
          id: 'pickup_dropoff',
          type: 'checkbox',
          label: 'Pickup and drop-off services',
          multiple: true,
          options: [
            makeOption('Pickup service', 'pickup_service'),
            makeOption('Drop-Off service', 'dropoff_service'),
            makeOption('Both services', 'both_services'),
          ],
        },
      ],
    },
    {
      id: 'comfort_environment',
      type: 'group',
      label: 'Comfort and environment',
      fields: [
        {
          id: 'room_type_selection',
          type: 'radio',
          label: 'Room type selection',
          options: [
            makeOption('Standard room', 'standard_room'),
            makeOption('Premium room', 'premium_room'),
            makeOption('Suite room', 'suite_room'),
          ],
        },
        {
          id: 'playgroup_participation',
          type: 'radio',
          label: 'Playgroup participation options',
          options: [
            makeOption('Participate', 'participate'),
            makeOption('Do not participate', 'do_not_participate'),
          ],
        },
        {
          id: 'bedding_preferences',
          type: 'radio',
          label: 'Bedding preferences',
          options: [
            makeOption('Facility bedding', 'facility_bedding'),
            makeOption('Own bedding', 'own_bedding'),
            makeOption('Orthopaedic bedding', 'orthopaedic_bedding'),
          ],
        },
      ],
    },
  ],
  'Boarder - Dietary Plan': [
    {
      id: 'dietary_type',
      type: 'radio',
      label: 'Dietary type',
      options: [
        makeOption('Commercial / Packaged Food', 'commercial_packaged'),
        makeOption('Raw or Natural Diet', 'raw_natural'),
        makeOption('Home-Cooked Meals', 'home_cooked'),
        makeOption('Vegetarian / Vegan', 'vegetarian_vegan'),
      ],
    },
    { id: 'diet_special_notes', type: 'textarea', label: 'Special notes' },
    frequencyRadio('feeding_frequency', 'Feeding frequency and timing'),
    { id: 'specific_feeding_times', type: 'textarea', label: 'Specific feeding times' },
    {
      id: 'portion_preferences',
      type: 'radio',
      label: 'Portion preferences',
      options: [
        makeOption('Fixed weight per meal (grams or cups)', 'fixed_weight'),
        makeOption('“Until full” feeding', 'until_full'),
        makeOption('Measured scoop or bowl (parent-defined)', 'measured_scoop'),
      ],
    },
    { id: 'portion_special_notes', type: 'textarea', label: 'Special notes' },
    {
      id: 'brand_preferences',
      type: 'textarea',
      label: 'Brand preferences',
      placeholder: 'Write brand names here',
    },
    {
      id: 'feeding_method',
      type: 'radio',
      label: 'Feeding method preferences',
      options: [
        makeOption('Hand-feeding', 'hand_feeding'),
        makeOption('Self-feeding bowl', 'self_feeding'),
        makeOption('Separate feeding area (for anxious companions)', 'separate_area'),
        makeOption('Eat with other companion', 'eat_with_others'),
        makeOption('Heated / room-temperature food', 'heated_or_room_temp'),
      ],
    },
    { id: 'feeding_method_notes', type: 'textarea', label: 'Special notes' },
    {
      id: 'treat_preferences',
      type: 'checkbox',
      label: 'Treat preferences',
      multiple: true,
      options: [
        makeOption('Jerky treats', 'jerky'),
        makeOption('Dental sticks', 'dental_sticks'),
        makeOption('Dehydrated meat', 'dehydrated_meat'),
        makeOption('Homemade treats', 'homemade'),
        makeOption('Training treats only', 'training_only'),
        makeOption('No treats (parent restricted)', 'no_treats'),
      ],
    },
    {
      id: 'water_preferences',
      type: 'radio',
      label: 'Water preferences',
      options: [
        makeOption('Filtered / RO water only', 'filtered_ro'),
        makeOption('Regular tap water', 'tap_water'),
        makeOption('Bottled mineral water', 'bottled_mineral'),
        makeOption('Mix with electrolytes', 'electrolytes_mix'),
      ],
    },
    {
      id: 'water_additional_info',
      type: 'textarea',
      label: 'Additional information: allergies and time of water supply.',
    },
  ],
  'Boarder - Medication Details': [
    textInputField('medication_name', 'Medication name'),
    checkboxField('purpose_condition', 'Purpose / Condition', [
      makeOption('Skin allergy', 'skin_allergy'),
      makeOption('Arthritis', 'arthritis'),
      makeOption('Pain relief', 'pain_relief'),
    ]),
    checkboxField('form_type', 'Form type', [
      makeOption('Capsule', 'capsule'),
      makeOption('Tablet', 'tablet'),
      makeOption('Ear drops', 'ear_drops'),
      makeOption('Topical', 'topical'),
      makeOption('Liquid', 'liquid'),
      makeOption('Eye drops', 'eye_drops'),
      makeOption('Injection', 'injection'),
      makeOption('Inhalation', 'inhalation'),
    ]),
    textInputField('dosage', 'Dosage'),
    frequencyRadio('frequency', 'Frequency'),
    textInputField('timing_specific_hours', 'Timing (specific hours)'),
    radioField('given_with', 'Given with', [
      makeOption('Food', 'food'),
      makeOption('Milk', 'milk'),
      makeOption('Empty stomach', 'empty_stomach'),
      makeOption('Water', 'water'),
    ]),
    yesNoRadio('prescribed_by_vet', 'Prescribed by Vet'),
    dateField('start_date', 'Start date'),
    dateField('end_date', 'End date'),
  ],
  'Boarder - Daily Summary': [
    { id: 'summary_date', type: 'date', label: 'Daily summary date' },
    {
      id: 'meals_provided',
      type: 'radio',
      label: 'Meals provided to companion',
      options: [
        makeOption('Administered 1x daily', '1x_daily'),
        makeOption('Administered 2x daily', '2x_daily'),
        makeOption('Administered 3x daily', '3x_daily'),
      ],
    },
    { id: 'meals_additional_notes', type: 'textarea', label: 'Additional Notes / Activity report' },
    {
      id: 'medication_administered',
      type: 'radio',
      label: 'Medication administered today',
      options: [makeOption('Scheduled time entry', 'scheduled_time')],
    },
    {
      id: 'medication_additional_notes',
      type: 'textarea',
      label: 'Additional Notes / Activity report',
    },
    {
      id: 'daily_walk_completed',
      type: 'radio',
      label: 'Daily companion walk completed',
      options: [
        makeOption('Completed 1x', '1x'),
        makeOption('Completed 2x', '2x'),
        makeOption('Completed 3x', '3x'),
      ],
    },
    { id: 'walk_additional_notes', type: 'textarea', label: 'Additional Notes / Activity report' },
    {
      id: 'daily_exercise_completed',
      type: 'radio',
      label: 'Daily exercise completed',
      options: [
        makeOption('Completed 1x', '1x'),
        makeOption('Completed 2x', '2x'),
        makeOption('Completed 3x', '3x'),
      ],
    },
    {
      id: 'exercise_additional_notes',
      type: 'textarea',
      label: 'Additional Notes / Activity report',
    },
    {
      id: 'daily_poop_completed',
      type: 'radio',
      label: 'Daily pooping completed',
      options: [makeOption('Completed 1x', '1x'), makeOption('Completed 2x', '2x')],
    },
    { id: 'poop_additional_notes', type: 'textarea', label: 'Additional Notes / Activity report' },
    { id: 'pet_behavior_summary', type: 'textarea', label: 'companion behavior summary' },
    { id: 'additional_expense', type: 'textarea', label: 'Additional expense' },
  ],
  'Boarder - Schedule': [
    frequencyRadio('poop_frequency', 'Poop frequency and timing'),
    { id: 'poop_time_slot', type: 'input', label: 'Specific time slot' },
    frequencyRadio('walking_time', 'Walking time'),
    { id: 'walking_time_slot', type: 'input', label: 'Time slot' },
    {
      id: 'exercise_time',
      type: 'input',
      label: 'Exercise time',
      placeholder: 'Describe exercise / Add link',
    },
    frequencyRadio('exercise_frequency', 'Exercise frequency'),
    { id: 'exercise_time_slot', type: 'input', label: 'Time slot' },
  ],
  'Boarder - Belongings': [
    ...buildYesNoFieldList([
      ['pet_bedding', 'Companion bedding'],
      ['food_bowl', 'Food bowl'],
      ['pet_leash', 'Companion leash'],
      ['litter_tray', 'Litter tray'],
    ]),
    ...buildTextAreaFieldList([['list_of_toys', 'List of toys']]),
  ],
  'Breeder - Health & Behavior': [
    ...buildYesNoFieldList([
      ['signs_of_stress', 'Signs of stress'],
      ['signs_of_discharge', 'Signs of discharge'],
      ['signs_of_injury', 'Signs of injury'],
    ]),
    appetiteStatusRadio('appetite_status', 'Companion appetite status'),
    behaviorStatusCheckbox('behavior_status', 'Companion behavior status'),
    {
      id: 'energy_level',
      type: 'radio',
      label: 'Energy level',
      options: [
        makeOption('Energetic', 'energetic'),
        makeOption('Lethargic', 'lethargic'),
        makeOption('Weak', 'weak'),
        makeOption('Normal', 'normal'),
        makeOption('Overexcited', 'overexcited'),
      ],
    },
    {
      id: 'sleep_pattern',
      type: 'radio',
      label: 'Companion sleep pattern',
      options: [
        makeOption('Normal sleep', 'normal_sleep'),
        makeOption('Lethargy', 'lethargy'),
        makeOption('Sleeps well after activity', 'sleeps_well_after_activity'),
        makeOption('Restless', 'restless'),
        makeOption('Difficulty settling', 'difficulty_settling'),
      ],
    },
  ],
  'Breeder - Mating Log': [
    dateField('mating_date', 'Tracking mating date'),
    textInputField('mating_time', 'Tracking mating time'),
    ...buildYesNoFieldList([
      ['natural_mating_process', 'Utilised natural mating process'],
      ['genetic_screening_completed', 'Completed genetic screening'],
      ['fertility_assessment_completed', 'Completed fertility assessment'],
    ]),
    appetiteStatusRadio('appetite_status', 'Companion appetite status'),
    behaviorStatusCheckbox('behavior_status', 'Companion behaviour status'),
    ...buildYesNoFieldList([
      ['ultrasound_pregnancy_check', 'Complete ultrasound / pregnancy check'],
      ['birthing_assistance_provided', 'Provided birthing assistance'],
      ['neonatal_care_provided', 'Provided neonatal / newborn care'],
      ['record_keeping_completed', 'Record keeping completed'],
    ]),
  ],
  'Breeder - Consultation & Planning': [
    {
      id: 'consultation_for_clients',
      type: 'checkbox',
      label: 'Breeding consultation for clients',
      multiple: true,
      options: [
        makeOption('Stud services', 'stud_services'),
        makeOption('Breeding services', 'breeding_services'),
      ],
    },
    {
      id: 'heat_status_confirmation',
      type: 'checkbox',
      label: "Confirm the female's heat status",
      multiple: true,
      options: [
        makeOption('Visual examination', 'visual_examination'),
        makeOption('Progesterone testing', 'progesterone_testing'),
      ],
    },
    dateField('fertile_phase_start_date', 'Tracking the fertile phase - Start date'),
    dateField('fertile_phase_end_date', 'Tracking the fertile phase - End date'),
    ...buildYesNoFieldList([
      ['provide_list_of_potential_mates', 'Provide a list of potential mates'],
      ['preferred_vet_services_required', 'Preferred veterinary services required'],
    ]),
    ...buildTextAreaFieldList([
      ['preferred_vet_details', "If yes, specify veterinarian's details"],
    ]),
  ],
  'Breeder - Mating & Fertility Preferences': [
    yesNoRadio('natural_mating', 'Natural mating'),
    {
      id: 'artificial_insemination',
      type: 'checkbox',
      label: 'Artificial Insemination',
      multiple: true,
      options: [
        makeOption('Fresh semen', 'fresh_semen'),
        makeOption('Chilled semen', 'chilled_semen'),
        makeOption('Frozen semen', 'frozen_semen'),
      ],
    },
    yesNoRadio('semen_collection_evaluation', 'Semen collection and evaluation'),
    {
      id: 'genetic_screening',
      type: 'checkbox',
      label: 'Genetic screening',
      multiple: true,
      options: [
        makeOption('DNA testing', 'dna_testing'),
        makeOption('Genetic disorder screening', 'genetic_disorder_screening'),
        makeOption('Breed identification', 'breed_identification'),
      ],
    },
    yesNoRadio('fertility_assessment', 'Fertility assessment'),
  ],
  'Breeder - Belongings': [
    ...buildYesNoFieldList([
      ['pet_bedding_or_blanket', 'Companion bedding or blanket'],
      ['pet_crate', 'Companion crate'],
      ['pet_leash', 'Companion leash'],
      ['litter_tray', 'Litter tray'],
    ]),
    ...buildTextAreaFieldList([['list_of_toys', 'List of toys']]),
  ],
  'Breeder - Check-in': [
    textInputField('body_temperature', "Pet's body temperature"),
    {
      id: 'appetite_status_checkin',
      type: 'radio',
      label: "Companion's appetite status",
      options: [
        makeOption('Strong appetite', 'strong_appetite'),
        makeOption('Normal appetite', 'normal_appetite'),
        makeOption('Increased appetite', 'increased_appetite'),
        makeOption('Refusing to eat', 'refusing_to_eat'),
        makeOption('Selective appetite', 'selective_appetite'),
        makeOption('Decreased appetite', 'decreased_appetite'),
      ],
    },
    {
      id: 'behavior_status_checkin',
      type: 'checkbox',
      label: "Companion's behavior status",
      multiple: true,
      options: [
        makeOption('Friendly behavior', 'friendly_behavior'),
        makeOption('Alert behavior', 'alert_behavior'),
        makeOption('Nervous behavior', 'nervous_behavior'),
        makeOption('Defensive behavior', 'defensive_behavior'),
        makeOption('Aggressive behavior', 'aggressive_behavior'),
        makeOption('Highly anxious behavior', 'highly_anxious_behavior'),
      ],
    },
    {
      id: 'confirm_female_heat_status',
      type: 'checkbox',
      label: "Confirm female's heat status",
      multiple: true,
      options: [
        makeOption('Visual examination', 'visual_examination'),
        makeOption('Progesterone testing', 'progesterone_testing'),
      ],
    },
    ...buildTextAreaFieldList([['heat_status_notes', 'Please provide additional information']]),
  ],
  'Breeder - Pregnancy Care': [
    ...buildYesNoFieldList([
      ['ultrasound_pregnancy_checks', 'Ultrasound and pregnancy checks'],
      ['birthing_assistance', 'Birthing assistance'],
      ['neonatal_newborn_care', 'Neonatal and newborn care'],
      ['record_keeping', 'Record keeping'],
      ['post_pregnancy_care', 'Post-pregnancy care'],
    ]),
  ],
  'Breeder - Health Summary': [
    ...buildTextAreaFieldList([['pet_health_summary', 'Companion health summary']]),
  ],
  'Groomer - Service Request & Preferences': [
    ...buildYesNoFieldList([
      ['bathing_basic', 'Given basic bath'],
      ['ear_cleaning', 'Given ear cleaning?'],
      ['teeth_brushing', 'Added teeth brushing'],
      ['de_shedding_treatment', 'De-shedding treatment'],
      ['conditioner_after_groom', 'Given conditioner treatment after grooming'],
      ['dematting_detangling', 'Dematting / Detangling'],
      ['nail_trimming', 'Nail trimming'],
      ['paw_pad_cleaning', 'Paw pad Cleaning'],
      ['anal_gland_expression', 'Anal gland expression'],
      ['tick_flea_treatment', 'Tick and flea treatment'],
      ['perfume_finishing_spray', 'Perfume / Finishing spray'],
    ]),
    {
      id: 'bath_type',
      type: 'radio',
      label: 'Choose bath type',
      options: [
        makeOption('Basic', 'basic'),
        makeOption('De-shedding', 'de_shedding'),
        makeOption('Medicate', 'medicate'),
        makeOption('Whitening', 'whitening'),
      ],
    },
    {
      id: 'haircut_style',
      type: 'radio',
      label: 'Choose haircut style',
      options: [
        makeOption('Breed standard', 'breed_standard'),
        makeOption('Summer cut', 'summer_cut'),
        makeOption('Custom', 'custom'),
      ],
    },
    textInputField('conditioner_brand', 'Specify conditioner brand'),
    {
      id: 'aromatherapy_bath',
      type: 'radio',
      label: 'Aromatherapy bath',
      options: [
        makeOption('Aromatherapy', 'aromatherapy'),
        makeOption('Herbal', 'herbal'),
        makeOption('Oatmeal', 'oatmeal'),
      ],
    },
  ],
  'Groomer - Grooming Prep': [
    ...buildYesNoFieldList([
      ['brushing_detangle_service', 'Given brushing and detangle service to companion'],
      ['nail_trimming_paw_cleaning', 'Given nail trimming and paw cleaning'],
      ['ear_cleaning_infection_check', 'Given ear cleaning and infection check-up'],
      ['medicated_bath_needed', 'Does companion require medicated bath to prevent flea / tick'],
      ['anal_gland_checked', 'Anal gland checked'],
      ['sanitary_area_trimming', 'Given sanitary area trimming'],
    ]),
  ],
  'Groomer - Bathing & Cleaning Worklog': [
    ...buildYesNoFieldList([
      ['basic_bath_done', 'Given basic bath'],
      ['deshedding_done', 'Given de-shedding treatment'],
      ['rinse_conditioning_done', 'Given thorough rinse and conditioning.'],
      ['paw_pad_care_done', 'Given paw pad cleaning and care'],
    ]),
  ],
  'Groomer - Haircut / Styling Worklog': [
    ...buildYesNoFieldList([
      ['drying_with_dryer', 'Given drying with towel + pet dryer'],
      ['parent_requested_styling_done', 'Given parent-requested styling'],
      ['clipping_shaping_fluff', 'Given clipping, shaping, and fluff drying.'],
    ]),
  ],
  'Groomer - Spa Add-ons Worklog': [
    ...buildYesNoFieldList([
      ['final_brushing_done', 'Given final brushing'],
      ['tick_flea_treatment_done', 'Given tick & flea treatment'],
      ['parent_requested_styling_addon', 'Given parent-requested styling'],
      ['perfume_spray_done', 'Given perfume / finishing spray'],
      ['clean_fresh_collar', 'Given clean and fresh collar'],
    ]),
  ],
  'Groomer - Health Requirements': [
    ...buildYesNoFieldList([
      ['grooming_history', 'Has your companion received grooming services before?'],
      ['allergies_or_skin_issues', 'Does your companion suffer from any allergies or skin issues?'],
    ]),
    ...buildTextAreaFieldList([['allergy_details', 'If yes, please provide details']]),
    {
      id: 'preferred_coat_specs_image',
      type: 'input',
      label: 'Preferred coat specifications (image)',
      meta: { accept: 'image/*', upload: true } as any,
    },
    ...buildTextInputFieldList([
      ['preferred_coat_specs_notes', 'Please describe here'],
      ['wound_area_details', 'Specify wound area (if any)'],
    ]),
  ],
};

export type BackendFormStatus = BackendForm['status'];
