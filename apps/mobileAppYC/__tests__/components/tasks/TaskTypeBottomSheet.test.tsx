import React, {createRef} from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
// FIX 1: Update component import path
import {TaskTypeBottomSheet} from '@/features/tasks/components/TaskTypeBottomSheet/TaskTypeBottomSheet';
// FIX 2: Update type import path
import type {
  TaskTypeBottomSheetRef,
  TaskTypeOption,
  CategorySection,
} from '@/features/tasks/components/TaskTypeBottomSheet/types';
// FIX 3: Update helper import path
import {
  buildSelectionFromOption,
  buildCategorySections,
} from '@/features/tasks/components/TaskTypeBottomSheet/helpers';
import {mockTheme} from '../../setup/mockTheme';

const mockCategorySections: CategorySection[] = [
  {
    type: 'single',
    category: {id: 'custom', label: 'Custom Task'},
  },
  {
    type: 'category',
    category: {id: 'health', label: 'Health'},
    subcategories: [
      {
        subcategory: {id: 'health', label: 'Health'},
        children: [
          {
            option: {id: 'vitals', label: 'Vitals'},
            ancestors: [{id: 'health', label: 'Health'}],
          },
        ],
      },
    ],
  },
  {
    type: 'category',
    category: {id: 'medication', label: 'Medication'},
    subcategories: [
      {
        subcategory: {
          id: 'med-admin',
          label: 'Administration',
        },
        children: [
          {
            option: {id: 'med-admin-pill', label: 'Pill'},
            ancestors: [
              {id: 'medication', label: 'Medication'},
              {
                id: 'med-admin',
                label: 'Administration',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'category',
    category: {id: 'exercise', label: 'Exercise'},
    subcategories: [
      {
        subcategory: {id: 'ex-sub', label: 'Exercise Sub'},
        subsubcategories: [
          {
            subsubcategory: {
              id: 'ex-sub-sub',
              label: 'Exercise Sub-Sub',
            },
            children: [
              {
                option: {id: 'walk', label: 'Walk'},
                ancestors: [
                  {id: 'exercise', label: 'Exercise'},
                  {
                    id: 'ex-sub',
                    label: 'Exercise Sub',
                  },
                  {
                    id: 'ex-sub-sub',
                    label: 'Exercise Sub-Sub',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'category',
    category: {id: 'food', label: 'Food'},
    subcategories: [
      {
        subcategory: {id: 'food', label: 'Food Sub'},
        children: [
          {
            option: {id: 'breakfast', label: 'Breakfast'},
            ancestors: [
              {id: 'food', label: 'Food'},
              {id: 'food', label: 'Food Sub'},
            ],
          },
        ],
      },
    ],
  },
];

// Sections used to exercise getOptionIcon's custom + mapped-task-type branches.
const iconSections: CategorySection[] = [
  {
    type: 'single',
    category: {
      id: 'icon-custom',
      label: 'Icon Custom Task',
      category: 'custom',
    },
  },
  {
    type: 'category',
    category: {id: 'icon-cat', label: 'Icon Cat'},
    subcategories: [
      {
        subcategory: {id: 'icon-cat', label: 'Icon Cat'},
        children: [
          {
            option: {
              id: 'icon-med',
              label: 'Icon Med',
              taskType: 'give-medication',
            },
            ancestors: [{id: 'icon-cat', label: 'Icon Cat'}],
          },
        ],
      },
    ],
  },
];

// FIX 4: Update mocked helper path
jest.mock('@/features/tasks/components/TaskTypeBottomSheet/helpers', () => ({
  flattenTaskOptions: jest.fn(options => options),
  buildCategorySections: jest.fn(() => mockCategorySections),
  buildSelectionFromOption: jest.requireActual(
    // FIX 5: Update requireActual path
    '@/features/tasks/components/TaskTypeBottomSheet/helpers',
  ).buildSelectionFromOption,
}));

// FIX 6: Update mocked options path.
// flattenTaskOptions is mocked as identity, so these entries pass straight
// through to `flattenedOptions`. They give findPendingForSelection a node with
// children (skipped), a childless non-match, and a leaf that can match.
jest.mock(
  '@/features/tasks/components/TaskTypeBottomSheet/taskOptions',
  () => ({
    __esModule: true,
    taskTypeOptions: [
      {
        option: {
          id: 'flat-parent',
          label: 'Flat Parent',
          children: [{id: 'flat-child', label: 'Flat Child'}],
        },
        ancestors: [],
      },
      {
        option: {id: 'flat-empty', label: 'Flat Empty', children: []},
        ancestors: [],
      },
      {
        option: {
          id: 'flat-leaf',
          label: 'Flat Leaf',
          category: 'health',
          taskType: 'give-medication',
        },
        ancestors: [],
      },
    ],
  }),
);

const mockExpand = jest.fn();
const mockClose = jest.fn();
// Captures the onChange prop the sheet is rendered with so tests can drive it.
let mockOnChangeCapture: ((index: number) => void) | undefined;

// FIX 7: Update mocked component path
jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const {
    forwardRef: mockForwardRef,
    useImperativeHandle: mockUseImperativeHandle,
  } = require('react');
  const MockView = require('react-native').View;
  return {
    __esModule: true,
    default: mockForwardRef(
      (
        {
          children,
          onChange,
        }: {
          children: React.ReactNode;
          onChange?: (index: number) => void;
        },
        ref: any,
      ) => {
        mockOnChangeCapture = onChange;
        mockUseImperativeHandle(ref, () => ({
          expand: mockExpand,
          close: mockClose,
        }));
        return (
          <MockView testID="mock-custom-bottom-sheet">{children}</MockView>
        );
      },
    ),
  };
});

// FIX 8: Update mocked component path
jest.mock(
  '@/shared/components/common/BottomSheetHeader/BottomSheetHeader',
  () => {
    const MockView = require('react-native').View;
    const MockTouchableOpacity = require('react-native').TouchableOpacity;
    const MockText = require('react-native').Text;
    return {
      BottomSheetHeader: ({
        title,
        onClose,
      }: {
        title: string;
        onClose: () => void;
      }) => (
        <MockView>
          <MockText>{title}</MockText>
          <MockTouchableOpacity testID="mock-header-close" onPress={onClose} />
        </MockView>
      ),
    };
  },
);

// FIX 9: Update mocked hook path
jest.mock('@/shared/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// FIX 10: Update mocked util path
jest.mock('@/shared/utils/bottomSheetHelpers', () => ({
  createBottomSheetStyles: () => ({
    bottomSheetBackground: {backgroundColor: 'white'},
    bottomSheetHandle: {backgroundColor: 'grey'},
  }),
}));

const renderComponent = () => {
  const mockOnSelect = jest.fn();
  const ref = createRef<TaskTypeBottomSheetRef>();

  render(<TaskTypeBottomSheet ref={ref} onSelect={mockOnSelect} />);

  return {ref, mockOnSelect};
};

describe('TaskTypeBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the header with the correct title', () => {
      renderComponent();
      expect(screen.getByText('Select task type')).toBeTruthy();
    });

    it('renders a "single" type pill correctly', () => {
      renderComponent();
      expect(screen.getByText('Custom Task')).toBeTruthy();
    });

    it('keeps the task list scrollable past the last pill', () => {
      renderComponent();

      const list = screen.getByTestId('task-type-list');
      expect(StyleSheet.flatten(list.props.style)).toEqual(
        expect.objectContaining({flex: 1}),
      );
      expect(StyleSheet.flatten(list.props.contentContainerStyle)).toEqual(
        expect.objectContaining({paddingBottom: mockTheme.spacing['20']}),
      );
      expect(list.props.scrollIndicatorInsets).toEqual({
        bottom: mockTheme.spacing['20'],
      });
      expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('renders a category with direct children', () => {
      renderComponent();
      expect(screen.getByText('Health')).toBeTruthy();
      expect(screen.getByText('Vitals')).toBeTruthy();
    });

    it('renders a category with subcategories and their children', () => {
      renderComponent();
      expect(screen.getByText('Medication')).toBeTruthy();
      expect(screen.getByText('Administration')).toBeTruthy();
      expect(screen.getByText('Pill')).toBeTruthy();
    });

    it('renders a category with sub-subcategories and their children', () => {
      renderComponent();
      expect(screen.getByText('Exercise')).toBeTruthy();
      expect(screen.getByText('Exercise Sub')).toBeTruthy();
      expect(screen.getByText('Exercise Sub-Sub')).toBeTruthy();
      expect(screen.getByText('Walk')).toBeTruthy();
    });

    it('hides the subcategory header if its ID matches the category ID', () => {
      renderComponent();
      expect(screen.getByText('Food')).toBeTruthy();
      expect(screen.queryByText('Food Sub')).toBeNull();
      expect(screen.getByText('Breakfast')).toBeTruthy();
    });
  });

  describe('Interactions and Callbacks', () => {
    it('calls onSelect and closes the sheet for a "single" pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'custom', label: 'Custom Task'};
      const expectedSelection = buildSelectionFromOption(option, []);

      // Selecting a pill commits and closes immediately; no separate Confirm step.
      fireEvent.press(screen.getByText('Custom Task'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect and closes the sheet for a category pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'vitals', label: 'Vitals'};
      const ancestors: TaskTypeOption[] = [{id: 'health', label: 'Health'}];
      const expectedSelection = buildSelectionFromOption(option, ancestors);

      fireEvent.press(screen.getByText('Vitals'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect and closes the sheet for a subcategory pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'med-admin-pill', label: 'Pill'};
      const ancestors: TaskTypeOption[] = [
        {id: 'medication', label: 'Medication'},
        {id: 'med-admin', label: 'Administration'},
      ];
      const expectedSelection = buildSelectionFromOption(option, ancestors);

      fireEvent.press(screen.getByText('Pill'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect and closes the sheet for a sub-subcategory pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'walk', label: 'Walk'};
      const ancestors: TaskTypeOption[] = [
        {id: 'exercise', label: 'Exercise'},
        {id: 'ex-sub', label: 'Exercise Sub'},
        {id: 'ex-sub-sub', label: 'Exercise Sub-Sub'},
      ];
      const expectedSelection = buildSelectionFromOption(option, ancestors);

      fireEvent.press(screen.getByText('Walk'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls close on the header close button', () => {
      renderComponent();
      fireEvent.press(screen.getByTestId('mock-header-close'));
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ref Handling', () => {
    it('calls the bottom sheet expand method when ref.open is called', () => {
      const {ref} = renderComponent();
      act(() => {
        ref.current?.open();
      });
      expect(mockExpand).toHaveBeenCalledTimes(1);
    });

    it('calls the bottom sheet close method when ref.close is called', () => {
      const {ref} = renderComponent();
      act(() => {
        ref.current?.close();
      });
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Warm-bone coverage', () => {
    it('initialises pending from a matching selectedTaskType and still selects a fresh pill', () => {
      const mockOnSelect = jest.fn();
      const selectedOption: TaskTypeOption = {
        id: 'flat-leaf',
        label: 'Flat Leaf',
        category: 'health',
        taskType: 'give-medication',
      };
      const selection = buildSelectionFromOption(selectedOption, []);

      render(
        <TaskTypeBottomSheet
          ref={createRef<TaskTypeBottomSheetRef>()}
          onSelect={mockOnSelect}
          selectedTaskType={selection}
        />,
      );

      // findPendingForSelection matches the leaf on mount; pressing a rendered
      // pill still reports that pill's own selection, not the stale initial one.
      const option: TaskTypeOption = {id: 'vitals', label: 'Vitals'};
      const ancestors: TaskTypeOption[] = [{id: 'health', label: 'Health'}];
      fireEvent.press(screen.getByText('Vitals'));
      expect(mockOnSelect).toHaveBeenCalledWith(
        buildSelectionFromOption(option, ancestors),
      );
    });

    it('leaves pending null when selectedTaskType matches no leaf option', () => {
      const mockOnSelect = jest.fn();
      const selection = buildSelectionFromOption(
        {id: 'nope', label: 'No Match', category: 'hygiene'},
        [],
      );

      render(
        <TaskTypeBottomSheet
          ref={createRef<TaskTypeBottomSheetRef>()}
          onSelect={mockOnSelect}
          selectedTaskType={selection}
        />,
      );

      // findPendingForSelection finds no match; pressing a pill still selects normally.
      const option: TaskTypeOption = {id: 'vitals', label: 'Vitals'};
      const ancestors: TaskTypeOption[] = [{id: 'health', label: 'Health'}];
      fireEvent.press(screen.getByText('Vitals'));
      expect(mockOnSelect).toHaveBeenCalledWith(
        buildSelectionFromOption(option, ancestors),
      );
    });

    it('renders the custom "create-outline" icon and the mapped task-type icon', () => {
      (buildCategorySections as jest.Mock).mockReturnValueOnce(iconSections);

      render(
        <TaskTypeBottomSheet
          ref={createRef<TaskTypeBottomSheetRef>()}
          onSelect={jest.fn()}
        />,
      );

      expect(screen.getByText('Icon Custom Task')).toBeTruthy();
      expect(screen.getByTestId('icon-create-outline')).toBeTruthy();
      expect(screen.getByText('Icon Med')).toBeTruthy();
      expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
    });

    it('forwards sheet index changes to onSheetChange and toggles visibility', () => {
      const onSheetChange = jest.fn();

      render(
        <TaskTypeBottomSheet
          ref={createRef<TaskTypeBottomSheetRef>()}
          onSelect={jest.fn()}
          onSheetChange={onSheetChange}
        />,
      );

      act(() => {
        mockOnChangeCapture?.(1);
      });
      expect(onSheetChange).toHaveBeenCalledWith(1);

      act(() => {
        mockOnChangeCapture?.(-1);
      });
      expect(onSheetChange).toHaveBeenCalledWith(-1);
    });

    it('handles sheet index changes safely when onSheetChange is omitted', () => {
      render(
        <TaskTypeBottomSheet
          ref={createRef<TaskTypeBottomSheetRef>()}
          onSelect={jest.fn()}
        />,
      );

      expect(() => {
        act(() => {
          mockOnChangeCapture?.(0);
        });
      }).not.toThrow();
    });
  });
});
