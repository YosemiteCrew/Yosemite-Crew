import type {TaskTypeOption} from './types';
import type {ParasitePreventionType, ChronicConditionType} from '@/features/tasks/types';

/**
 * Creates standard medication + observational tool children for a task
 */
const createStandardHealthTaskChildren = (
  prefix: string,
  includeObservationTool: boolean = false,
): TaskTypeOption[] => {
  const children: TaskTypeOption[] = [
    {
      id: `${prefix}-medication`,
      label: 'Give medication',
      taskType: 'give-medication',
    },
  ];

  if (includeObservationTool) {
    children.push({
      id: `${prefix}-tool`,
      label: 'Take observational tool',
      taskType: 'take-observational-tool',
    });
  }

  return children;
};

/**
 * Creates a chronic condition option with standard children
 */
const createChronicConditionOption = (
  id: string,
  label: string,
  conditionType: ChronicConditionType,
  includeObservationTool: boolean = false,
): TaskTypeOption => ({
  id,
  label,
  chronicConditionType: conditionType,
  children: createStandardHealthTaskChildren(id, includeObservationTool),
});

/**
 * Creates a parasite prevention option with standard children
 */
const createParasitePreventionOption = (
  id: string,
  label: string,
  preventionType: ParasitePreventionType,
): TaskTypeOption => ({
  id,
  label,
  parasitePreventionType: preventionType,
  children: createStandardHealthTaskChildren(id, false),
});

/**
 * Creates a simple task option (hygiene or dietary)
 */
const createSimpleTaskOption = (
  id: string,
  label: string,
  taskType: string,
): TaskTypeOption => ({
  id,
  label,
  taskType,
});

/**
 * All task type options organized hierarchically
 */
export const taskTypeOptions: TaskTypeOption[] = [
  {
    id: 'custom',
    label: 'Custom',
    category: 'custom',
  },
  {
    id: 'health',
    label: 'Health',
    category: 'health',
    children: [
      {
        id: 'health-vaccination',
        label: 'Vaccination',
        subcategory: 'vaccination',
        children: [
          {
            id: 'health-vaccination-give-medication',
            label: 'Give medication',
            taskType: 'give-medication',
          },
        ],
      },
      {
        id: 'health-parasite',
        label: 'Parasite Prevention',
        subcategory: 'parasite-prevention',
        children: [
          createParasitePreventionOption('deworming', 'Deworming', 'deworming'),
          createParasitePreventionOption('flea-tick', 'Flea and tick prevention', 'flea-tick-prevention'),
        ],
      },
      {
        id: 'health-chronic',
        label: 'Chronic conditions',
        subcategory: 'chronic-conditions',
        children: [
          createChronicConditionOption('pain', 'Pain', 'pain', true),
          createChronicConditionOption('diabetes', 'Diabetes', 'diabetes', false),
          createChronicConditionOption('epilepsy', 'Epilepsy', 'epilepsy', false),
        ],
      },
    ],
  },
  {
    id: 'hygiene',
    label: 'Hygiene maintenance',
    category: 'hygiene',
    children: [
      createSimpleTaskOption('brushing-hair', 'Brushing hair', 'brushing-hair'),
      createSimpleTaskOption('dental-care', 'Dental care', 'dental-care'),
      createSimpleTaskOption('nail-trimming', 'Nail trimming', 'nail-trimming'),
      createSimpleTaskOption('give-bath', 'Give bath', 'give-bath'),
      createSimpleTaskOption('take-exercise', 'Take for exercise', 'take-exercise'),
      createSimpleTaskOption('give-training', 'Give training', 'give-training'),
    ],
  },
  {
    id: 'dietary',
    label: 'Dietary plan',
    category: 'dietary',
    children: [
      createSimpleTaskOption('meals', 'Meals', 'meals'),
      createSimpleTaskOption('freshwater', 'Freshwater', 'freshwater'),
    ],
  },
];
