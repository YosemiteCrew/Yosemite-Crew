import React, {createRef} from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
// FIX 1: Update component import path
import {TaskTypeBottomSheet} from '@/features/tasks/components/TaskTypeBottomSheet/TaskTypeBottomSheet';
// FIX 2: Update type import path
import type {
  TaskTypeBottomSheetRef,
  TaskTypeOption,
  CategorySection,
} from '@/features/tasks/components/TaskTypeBottomSheet/types';
// FIX 3: Update helper import path
import {buildSelectionFromOption} from '@/features/tasks/components/TaskTypeBottomSheet/helpers';

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

// FIX 4: Update mocked helper path
jest.mock('@/features/tasks/components/TaskTypeBottomSheet/helpers', () => ({
  flattenTaskOptions: jest.fn(options => options),
  buildCategorySections: jest.fn(() => mockCategorySections),
  buildSelectionFromOption: jest.requireActual(
    // FIX 5: Update requireActual path
    '@/features/tasks/components/TaskTypeBottomSheet/helpers',
  ).buildSelectionFromOption,
}));

// FIX 6: Update mocked options path
jest.mock(
  '@/features/tasks/components/TaskTypeBottomSheet/taskOptions',
  () => ({
    __esModule: true,
    taskTypeOptions: [],
  }),
);

const mockExpand = jest.fn();
const mockClose = jest.fn();

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
      ({children}: {children: React.ReactNode}, ref: any) => {
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
  useTheme: () => ({
    theme: {
      spacing: {'1': 4, '2': 8, '3': 12, '5': 20},
      colors: {
        background: 'white',
        text: 'black',
        textSecondary: 'gray',
      },
      typography: {bodySmall: {}, labelSmall: {}},
    },
  }),
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
      expect(screen.getByText('Select Task Type')).toBeTruthy();
    });

    it('renders a "single" type pill correctly', () => {
      renderComponent();
      expect(screen.getByText('Custom Task')).toBeTruthy();
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
    it('calls onSelect with correct structure for a "single" pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'custom', label: 'Custom Task'};
      const expectedSelection = buildSelectionFromOption(option, []);

      fireEvent.press(screen.getByText('Custom Task'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect with correct structure for a category pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'vitals', label: 'Vitals'};
      const ancestors: TaskTypeOption[] = [{id: 'health', label: 'Health'}];
      const expectedSelection = buildSelectionFromOption(option, ancestors);

      fireEvent.press(screen.getByText('Vitals'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
    });

    it('calls onSelect with correct structure for a subcategory pill', () => {
      const {mockOnSelect} = renderComponent();

      const option: TaskTypeOption = {id: 'med-admin-pill', label: 'Pill'};
      const ancestors: TaskTypeOption[] = [
        {id: 'medication', label: 'Medication'},
        {id: 'med-admin', label: 'Administration'},
      ];
      const expectedSelection = buildSelectionFromOption(option, ancestors);

      fireEvent.press(screen.getByText('Pill'));

      expect(mockOnSelect).toHaveBeenCalledWith(expectedSelection);
    });

    it('calls onSelect with correct structure for a sub-subcategory pill', () => {
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
});
