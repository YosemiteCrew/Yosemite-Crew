import type {
  TaskCategory,
  HealthSubcategory,
  ParasitePreventionType,
  ChronicConditionType,
  TaskTypeSelection,
} from '@/features/tasks/types';

export interface TaskTypeOption {
  id: string;
  label: string;
  category?: TaskCategory;
  subcategory?: HealthSubcategory;
  parasitePreventionType?: ParasitePreventionType;
  chronicConditionType?: ChronicConditionType;
  taskType?: string;
  children?: TaskTypeOption[];
}

export interface SubsubcategoryWithChildren {
  subsubcategory: TaskTypeOption;
  children: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>;
}

export interface SubcategoryWithChildren {
  subcategory: TaskTypeOption;
  subsubcategories?: SubsubcategoryWithChildren[];
  children?: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>;
}

export interface CategorySection {
  type: 'single' | 'category';
  category: TaskTypeOption;
  subcategories?: SubcategoryWithChildren[];
}

export interface TaskTypeBottomSheetRef {
  open: () => void;
  close: () => void;
}

export interface TaskTypeBottomSheetProps {
  selectedTaskType?: TaskTypeSelection | null;
  onSelect: (selection: TaskTypeSelection) => void;
  companionType?: 'cat' | 'dog' | 'horse';
}
