import {
  isLeafNode,
  isCategory,
  flattenTaskOptions,
  buildCategorySections,
  buildSelectionFromOption,
} from '@/features/tasks/components/TaskTypeBottomSheet/helpers';
import type {TaskTypeOption} from '@/features/tasks/components/TaskTypeBottomSheet/types';

// --- Mock Data ---

// We cast to `any` to simplify mock creation, but it adheres to TaskTypeOption
const leafBrush: TaskTypeOption = {
  id: 'brush',
  label: 'Brushing',
  taskType: 'brushing-hair',
} as any;
const leafBath: TaskTypeOption = {
  id: 'bath',
  label: 'Bathing',
  taskType: 'give-bath',
} as any;

const leafMeals: TaskTypeOption = {
  id: 'mealsLeaf',
  label: 'Feed',
  taskType: 'meals',
} as any;
const subcatMeals: TaskTypeOption = {
  id: 'meals',
  label: 'Meals',
  children: [leafMeals],
} as any;

const leafPain: TaskTypeOption = {
  id: 'painLeaf',
  label: 'Pain Meds',
  taskType: 'give-medication',
} as any;
const subsubcatPain: TaskTypeOption = {
  id: 'pain',
  label: 'Pain',
  chronicConditionType: 'pain',
  children: [leafPain],
} as any;
const subcatChronic: TaskTypeOption = {
  id: 'chronic',
  label: 'Chronic',
  subcategory: 'chronic-conditions',
  children: [subsubcatPain],
} as any;

const leafVax: TaskTypeOption = {
  id: 'vaxLeaf',
  label: 'Vaccinate',
  taskType: 'vaccination',
} as any;
const subcatVax: TaskTypeOption = {
  id: 'vax',
  label: 'Vaccination',
  subcategory: 'vaccination',
  children: [leafVax],
} as any;

const catHealth: TaskTypeOption = {
  id: 'health',
  label: 'Health',
  category: 'health',
  children: [subcatChronic, subcatVax],
} as any;
const catHygiene: TaskTypeOption = {
  id: 'hygiene',
  label: 'Hygiene',
  category: 'hygiene',
  children: [leafBrush, leafBath],
} as any;
const catDietary: TaskTypeOption = {
  id: 'dietary',
  label: 'Dietary',
  category: 'dietary',
  children: [subcatMeals],
} as any;
const catCustom: TaskTypeOption = {
  id: 'custom',
  label: 'Custom Task',
  category: 'custom',
} as any;
const catEmpty: TaskTypeOption = {
  id: 'empty',
  label: 'Empty Cat',
  category: 'hygiene',
  children: [],
} as any;

const mockTaskOptions: TaskTypeOption[] = [
  catHealth,
  catHygiene,
  catDietary,
  catCustom,
  catEmpty,
];

// --- Tests ---

describe('TaskTypeBottomSheet/helpers', () => {
  describe('isLeafNode', () => {
    it('should return true for empty children array', () => {
      expect(isLeafNode({id: 'a', label: 'A', children: []})).toBe(true);
    });

    it('should return true for undefined/null children', () => {
      expect(isLeafNode({id: 'a', label: 'A'})).toBe(true);
      expect(isLeafNode({id: 'a', label: 'A', children: null} as any)).toBe(
        true,
      );
    });

    it('should return false for non-empty children array', () => {
      expect(isLeafNode({id: 'a', label: 'A', children: [leafBrush]})).toBe(
        false,
      );
    });
  });

  describe('isCategory', () => {
    it('should return true for non-empty children array', () => {
      expect(isCategory({id: 'a', label: 'A', children: [leafBrush]})).toBe(
        true,
      );
    });

    it('should return false for empty children array', () => {
      expect(isCategory({id: 'a', label: 'A', children: []})).toBe(false);
    });

    it('should return false for undefined/null children', () => {

    });
  });

  describe('flattenTaskOptions', () => {
    const flattened = flattenTaskOptions(mockTaskOptions);

    it('should flatten all nodes in the tree', () => {
      // 5 cats + 3 subcats + 1 subsubcat + 5 leaves = 14 nodes
      expect(flattened).toHaveLength(14);
    });

    it('should return an empty array for empty input', () => {
      expect(flattenTaskOptions([])).toEqual([]);
    });

    it('should correctly assign ancestors for root nodes', () => {
      const healthNode = flattened.find(f => f.option.id === 'health');
      expect(healthNode?.ancestors).toEqual([]);
    });

    it('should correctly assign ancestors for 2nd-level nodes', () => {
      const chronicNode = flattened.find(f => f.option.id === 'chronic');
      expect(chronicNode?.ancestors).toEqual([catHealth]);
    });

    it('should correctly assign ancestors for 3rd-level nodes', () => {
      const painNode = flattened.find(f => f.option.id === 'pain');
      expect(painNode?.ancestors).toEqual([catHealth, subcatChronic]);
    });

    it('should correctly assign ancestors for 4th-level leaf nodes', () => {
      const painLeafNode = flattened.find(f => f.option.id === 'painLeaf');
      expect(painLeafNode?.ancestors).toEqual([
        catHealth,
        subcatChronic,
        subsubcatPain,
      ]);
    });

    it('should correctly assign ancestors for 2-level leaf nodes', () => {
      const brushNode = flattened.find(f => f.option.id === 'brush');
      expect(brushNode?.ancestors).toEqual([catHygiene]);
    });
  });

  describe('buildCategorySections', () => {
    const flattened = flattenTaskOptions(mockTaskOptions);
    const sections = buildCategorySections(flattened);

    it('should create a section for each root category with children (or custom)', () => {
      expect(sections).toHaveLength(4);
      const ids = sections.map(s => s.category.id);
      expect(ids).toEqual(['health', 'hygiene', 'dietary', 'custom']);
    });

    it('should correctly structure the "custom" single section', () => {
      const customSection = sections.find(s => s.category.id === 'custom');
      expect(customSection).toEqual({
        type: 'single',
        category: catCustom,
      });
    });

    it('should correctly structure a 2-level hierarchy (Hygiene)', () => {
      const hygieneSection = sections.find(s => s.category.id === 'hygiene');

      // FIX: Add truthy check
      expect(hygieneSection).toBeTruthy();
      expect(hygieneSection!.type).toBe('category');
      expect(hygieneSection!.subcategories).toHaveLength(1);
    });

    it('should correctly structure a 3-level hierarchy (Dietary)', () => {
      const dietarySection = sections.find(s => s.category.id === 'dietary');

      // FIX: Add truthy check
      expect(dietarySection).toBeTruthy();
      expect(dietarySection!.type).toBe('category');
      expect(dietarySection!.subcategories).toHaveLength(1);
    });

    it('should correctly structure a 4-level hierarchy (Health)', () => {
      const healthSection = sections.find(s => s.category.id === 'health');

      // FIX: Add truthy check
      expect(healthSection).toBeTruthy();
      expect(healthSection!.type).toBe('category');
      expect(healthSection!.subcategories).toHaveLength(2);
    });

    it('should return an empty array for empty input', () => {
      expect(buildCategorySections([])).toEqual([]);
    });

    it('should filter out leaf nodes at the root level', () => {
      const leafAtRoot: TaskTypeOption = {
        id: 'rootLeaf',
        label: 'Root Leaf',
      } as any;
      const flat = flattenTaskOptions([catCustom, leafAtRoot]);
      const sections = buildCategorySections(flat);
      expect(sections).toHaveLength(1);
      expect(sections[0].category.id).toBe('custom');
    });
  });

  describe('buildSelectionFromOption', () => {
    it('should build a full selection from ancestors', () => {
      const option = leafPain;
      const ancestors = [catHealth, subcatChronic, subsubcatPain];
      const selection = buildSelectionFromOption(option, ancestors);

      expect(selection).toEqual({
        category: 'health',
        subcategory: 'chronic-conditions',
        parasitePreventionType: undefined,
        chronicConditionType: 'pain',
        taskType: 'give-medication',
        label: 'Pain Meds',
      });
    });

    it('should let the option override ancestor properties', () => {
      const option: TaskTypeOption = {
        id: 'override',
        label: 'Override',
        category: 'hygiene',
        subcategory: 'vaccination',
      } as any;
      const ancestors = [catHealth, subcatChronic];
      const selection = buildSelectionFromOption(option, ancestors);

      expect(selection.category).toBe('hygiene');
      expect(selection.subcategory).toBe('vaccination');
    });

    it('should default category to "custom" if not found', () => {
      const option: TaskTypeOption = {id: 'custom', label: 'My Task'} as any;
      const ancestors: TaskTypeOption[] = [];
      const selection = buildSelectionFromOption(option, ancestors);

      expect(selection).toEqual({
        category: 'custom',
        subcategory: undefined,
        parasitePreventionType: undefined,
        chronicConditionType: undefined,
        taskType: undefined,
        label: 'My Task',
      });
    });
  });
});
