import type {
  TaskTypeOption,
  SubsubcategoryWithChildren,
  SubcategoryWithChildren,
  CategorySection,
} from './types';
import type {
  TaskCategory,
  HealthSubcategory,
  ParasitePreventionType,
  ChronicConditionType,
  TaskTypeSelection,
  HealthTaskType,
  HygieneTaskType,
  DietaryTaskType,
} from '@/features/tasks/types';

export const isLeafNode = (option: TaskTypeOption) =>
  !option.children || option.children.length === 0;

export const isCategory = (option: TaskTypeOption) =>
  option.children && option.children.length > 0;

export const flattenTaskOptions = (
  options: TaskTypeOption[],
  ancestors: TaskTypeOption[] = [],
): Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}> => {
  const result: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}> = [];

  for (const option of options) {
    result.push({option, ancestors});
    if (option.children && option.children.length > 0) {
      result.push(...flattenTaskOptions(option.children, [...ancestors, option]));
    }
  }

  return result;
};

const getDirectChildren = (
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
  parentId: string,
) => {
  return flattenedOptions.filter(
    child =>
      child.ancestors.length > 0 &&
      child.ancestors.at(-1)?.id === parentId,
  );
};

const getLeafNodes = (
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
  parentId: string,
) => {
  return flattenedOptions.filter(
    leaf =>
      leaf.ancestors.some(anc => anc.id === parentId) &&
      isLeafNode(leaf.option),
  );
};

const buildSubsubcategories = (
  subcatDirectChildren: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): SubsubcategoryWithChildren[] => {
  const subsubcategories: SubsubcategoryWithChildren[] = [];

  for (const subsubcat of subcatDirectChildren) {
    if (!isCategory(subsubcat.option)) continue;

    const subsubcatLeaves = getLeafNodes(flattenedOptions, subsubcat.option.id);

    if (subsubcatLeaves.length > 0) {
      subsubcategories.push({
        subsubcategory: subsubcat.option,
        children: subsubcatLeaves,
      });
    }
  }

  return subsubcategories;
};

const processSubcategoryWithThreeLevels = (
  subcat: {option: TaskTypeOption; ancestors: TaskTypeOption[]},
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): SubcategoryWithChildren | null => {
  const subcatDirectChildren = getDirectChildren(flattenedOptions, subcat.option.id);

  if (subcatDirectChildren.some(child => isCategory(child.option))) {
    const subsubcategories = buildSubsubcategories(subcatDirectChildren, flattenedOptions);

    if (subsubcategories.length > 0) {
      return {
        subcategory: subcat.option,
        subsubcategories,
      };
    }
  } else {
    const subcatLeaves = getLeafNodes(flattenedOptions, subcat.option.id);

    if (subcatLeaves.length > 0) {
      return {
        subcategory: subcat.option,
        children: subcatLeaves,
      };
    }
  }

  return null;
};

const processSubcategories = (
  directChildren: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): SubcategoryWithChildren[] => {
  const subcategories: SubcategoryWithChildren[] = [];

  for (const subcat of directChildren) {
    if (!isCategory(subcat.option)) continue;

    const result = processSubcategoryWithThreeLevels(subcat, flattenedOptions);
    if (result) {
      subcategories.push(result);
    }
  }

  return subcategories;
};

const buildCategorySectionWithHierarchy = (
  item: {option: TaskTypeOption; ancestors: TaskTypeOption[]},
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): CategorySection | null => {
  const directChildren = getDirectChildren(flattenedOptions, item.option.id);

  if (directChildren.some(child => isCategory(child.option))) {
    const subcategories = processSubcategories(directChildren, flattenedOptions);

    if (subcategories.length > 0) {
      return {
        type: 'category',
        category: item.option,
        subcategories,
      };
    }
  } else {
    const leaves = flattenedOptions.filter(
      leaf =>
        leaf.ancestors.length > 0 &&
        leaf.ancestors.at(-1)?.id === item.option.id &&
        isLeafNode(leaf.option),
    );

    if (leaves.length > 0) {
      return {
        type: 'category',
        category: item.option,
        subcategories: [
          {
            subcategory: item.option,
            children: leaves,
          },
        ],
      };
    }
  }

  return null;
};

export const buildCategorySections = (
  flattenedOptions: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): CategorySection[] => {
  const sections: CategorySection[] = [];

  for (const item of flattenedOptions) {
    if (item.ancestors.length > 0) continue;

    // Handle Custom separately
    if (item.option.id === 'custom') {
      sections.push({
        type: 'single',
        category: item.option,
      });
      continue;
    }

    // Handle other categories
    if (isCategory(item.option)) {
      const section = buildCategorySectionWithHierarchy(item, flattenedOptions);
      if (section) {
        sections.push(section);
      }
    }
  }

  return sections;
};

// Helper to find property in ancestors
const findInAncestors = <T extends keyof TaskTypeOption>(
  ancestors: TaskTypeOption[],
  property: T,
): TaskTypeOption[T] | undefined => {
  for (const ancestor of ancestors) {
    if (ancestor[property]) {
      return ancestor[property];
    }
  }
  return undefined;
};

// Build task selection from option and its ancestors
export const buildSelectionFromOption = (
  option: TaskTypeOption,
  ancestors: TaskTypeOption[],
): TaskTypeSelection => {
  const category: TaskCategory =
    option.category ?? findInAncestors(ancestors, 'category') ?? 'custom';

  const subcategory: HealthSubcategory | undefined =
    option.subcategory ?? findInAncestors(ancestors, 'subcategory');

  const parasitePreventionType: ParasitePreventionType | undefined =
    option.parasitePreventionType ?? findInAncestors(ancestors, 'parasitePreventionType');

  const chronicConditionType: ChronicConditionType | undefined =
    option.chronicConditionType ?? findInAncestors(ancestors, 'chronicConditionType');

  const taskType: HealthTaskType | HygieneTaskType | DietaryTaskType | undefined =
    option.taskType as HealthTaskType | HygieneTaskType | DietaryTaskType | undefined;

  return {
    category,
    subcategory,
    parasitePreventionType,
    chronicConditionType,
    taskType,
    label: option.label,
  };
};
