import React, {createRef} from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
import {TaskTypeBottomSheet} from '@/components/tasks/TaskTypeBottomSheet/TaskTypeBottomSheet';
import type {
  TaskTypeBottomSheetRef,
  TaskTypeOption,
  CategorySection,
} from '@/components/tasks/TaskTypeBottomSheet/types';
// Import the real helper function we are testing against
import {buildSelectionFromOption} from '@/components/tasks/TaskTypeBottomSheet/helpers';

// --- Mocks ---

// This is the data structure the component's useMemo hook expects from buildCategorySections
// FIX: Removed 'type' property from all mock objects to match TaskTypeOption
const mockCategorySections: CategorySection[] = [
  // 1. A "single" type pill
  {
    type: 'single',
    category: {id: 'custom', label: 'Custom Task'},
  },
  // 2. A category with direct children
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
  // 3. A category with subcategories
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
  // 4. A category with sub-subcategories
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
  // 5. A category that hides the subcategory header
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

// Mock the helpers module
jest.mock('@/components/tasks/TaskTypeBottomSheet/helpers', () => ({
  // We only mock the functions that build the data
  flattenTaskOptions: jest.fn(options => options),
  buildCategorySections: jest.fn(() => mockCategorySections),
  // We MUST use the real implementation of buildSelectionFromOption
  buildSelectionFromOption: jest.requireActual(
    '@/components/tasks/TaskTypeBottomSheet/helpers',
  ).buildSelectionFromOption,
}));

// Mock the data module
jest.mock('@/components/tasks/TaskTypeBottomSheet/taskOptions', () => ({
  __esModule: true,
  taskTypeOptions: [], // This doesn't matter now since helpers are mocked
}));

// Mock child components
const mockExpand = jest.fn();
const mockClose = jest.fn();

jest.mock('@/components/common/BottomSheet/BottomSheet', () => {
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

jest.mock('@/components/common/BottomSheetHeader/BottomSheetHeader', () => {
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
});

// Mock hooks and style utils
jest.mock('@/hooks', () => ({
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

jest.mock('@/utils/bottomSheetHelpers', () => ({
  createBottomSheetStyles: () => ({
    bottomSheetBackground: {backgroundColor: 'white'},
    bottomSheetHandle: {backgroundColor: 'grey'},
  }),
}));

// --- Helper ---

const renderComponent = () => {
  const mockOnSelect = jest.fn();
  const ref = createRef<TaskTypeBottomSheetRef>();

  render(<TaskTypeBottomSheet ref={ref} onSelect={mockOnSelect} />);

  return {ref, mockOnSelect};
};

// --- Tests ---

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
      expect(screen.getByText('Health')).toBeTruthy(); // Category Header
      expect(screen.getByText('Vitals')).toBeTruthy(); // Pill
    });

    it('renders a category with subcategories and their children', () => {
      renderComponent();
      expect(screen.getByText('Medication')).toBeTruthy(); // Category Header
      expect(screen.getByText('Administration')).toBeTruthy(); // Subcategory Header
      expect(screen.getByText('Pill')).toBeTruthy(); // Pill
    });

    it('renders a category with sub-subcategories and their children', () => {
      renderComponent();
      expect(screen.getByText('Exercise')).toBeTruthy(); // Category Header
      expect(screen.getByText('Exercise Sub')).toBeTruthy(); // Subcategory Header
      expect(screen.getByText('Exercise Sub-Sub')).toBeTruthy(); // Sub-Subcategory Header
      expect(screen.getByText('Walk')).toBeTruthy(); // Pill
    });

    it('hides the subcategory header if its ID matches the category ID', () => {
      renderComponent();
      expect(screen.getByText('Food')).toBeTruthy(); // Category Header
      expect(screen.queryByText('Food Sub')).toBeNull(); // Subcategory Header is hidden
      expect(screen.getByText('Breakfast')).toBeTruthy(); // Pill
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
