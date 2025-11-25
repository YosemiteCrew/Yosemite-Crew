import React from 'react';
import {render, act} from '@testing-library/react-native';
import DeleteDocumentBottomSheet, {
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    secondary: 'mockSecondaryColor',
    surface: 'mockSurfaceColor',
    borderMuted: 'mockBorderColor',
    white: 'mockWhiteColor',
  },
  typography: {
    buttonH6Clash19: {fontSize: 16, fontWeight: '600'},
  },
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

// 2. Mock child ConfirmActionBottomSheet
const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();
// We will spy on the props passed to the child
const mockChildSheet = jest.fn();
// We will store the callbacks to trigger them
let mockPrimaryOnPress: () => void;
let mockSecondaryOnPress: () => void;

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const ReactActual = jest.requireActual('react');
    const {View: RNView} = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: ReactActual.forwardRef((props: any, ref: any) => {
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));
        // Store the callbacks to be triggered by tests
        mockPrimaryOnPress = props.primaryButton.onPress;
        mockSecondaryOnPress = props.secondaryButton.onPress;
        // Spy on all props
        mockChildSheet(props);
        return <RNView testID="mock-confirm-sheet" />;
      }),
    };
  },
);

// 3. Mock react-native
jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View', // Needed for the mock child
}));

// 4. Mock console.error
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

// --- Tests ---

describe('DeleteDocumentBottomSheet', () => {
  const mockOnDelete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers(); // Use fake timers for async state
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockClear();
  });

  it('renders with default props', () => {
    render(<DeleteDocumentBottomSheet onDelete={mockOnDelete} />);

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete file',
        message: 'Are you sure you want to delete the file this document?',
        primaryButton: expect.objectContaining({
          label: 'Delete',
          disabled: false,
          loading: false,
        }),
        secondaryButton: expect.objectContaining({
          label: 'Cancel',
          disabled: false,
        }),
      }),
    );
  });

  it('renders with custom props', () => {
    render(
      <DeleteDocumentBottomSheet
        onDelete={mockOnDelete}
        documentTitle="MyFile.pdf"
        title="Custom Title"
        message="Custom Message"
        primaryLabel="Yes, Delete"
        secondaryLabel="No, Go Back"
      />,
    );

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Custom Title',
        message: 'Custom Message',
        primaryButton: expect.objectContaining({label: 'Yes, Delete'}),
        secondaryButton: expect.objectContaining({label: 'No, Go Back'}),
      }),
    );
  });

  it('forwards open and close refs', () => {
    const ref = React.createRef<DeleteDocumentBottomSheetRef>();
    render(<DeleteDocumentBottomSheet onDelete={mockOnDelete} ref={ref} />);

    act(() => {
      ref.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handles cancel press and calls onCancel', () => {
    render(
      <DeleteDocumentBottomSheet
        onDelete={mockOnDelete}
        onCancel={mockOnCancel}
      />,
    );

    act(() => {
      mockSecondaryOnPress();
    });

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('handles cancel press without an onCancel prop', () => {
    render(<DeleteDocumentBottomSheet onDelete={mockOnDelete} />);

    act(() => {
      mockSecondaryOnPress();
    });

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('handles successful async delete', async () => {
    // Mock an async function
    const asyncDelete = jest.fn(() => Promise.resolve());
    render(<DeleteDocumentBottomSheet onDelete={asyncDelete} />);

    // 1. Press Delete
    act(() => {
      mockPrimaryOnPress();
    });

    // 2. Check loading state
    expect(asyncDelete).toHaveBeenCalledTimes(1);
    expect(mockChildSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        primaryButton: expect.objectContaining({
          label: 'Deleting...',
          disabled: true,
          loading: true,
        }),
        secondaryButton: expect.objectContaining({
          disabled: true,
        }),
      }),
    );
    expect(mockSheetClose).not.toHaveBeenCalled();

    // 3. Resolve the promise
    await act(async () => {
      jest.runAllTimers();
    });

    // 4. Check final state
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockChildSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        primaryButton: expect.objectContaining({
          label: 'Delete',
          disabled: false,
          loading: false,
        }),
      }),
    );
  });

  // -------------------
  // --- THIS IS THE FIX ---
  // -------------------
  it('handles successful sync delete', async () => {
    // <-- 1. Add async
    const syncDelete = jest.fn();
    render(<DeleteDocumentBottomSheet onDelete={syncDelete} />);

    // 1. Press Delete
    // 2. Add await and wrap in async act
    await act(async () => {
      mockPrimaryOnPress();
    });

    // 3. Check loading state
    expect(syncDelete).toHaveBeenCalledTimes(1);


    // 4. Resolve microtasks and state updates
    // 5. Add await and wrap in async act
    await act(async () => {
      jest.runAllTimers();
    });

    // 6. Check final state
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockChildSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        primaryButton: expect.objectContaining({
          label: 'Delete',
          disabled: false,
          loading: false,
        }),
      }),
    );
  });

  it('handles failed async delete', async () => {
    const deleteError = new Error('API Failed');
    const asyncDelete = jest.fn(() => Promise.reject(deleteError));
    render(<DeleteDocumentBottomSheet onDelete={asyncDelete} />);

    // 1. Press Delete
    act(() => {
      mockPrimaryOnPress();
    });

    // 2. Check loading state
    expect(asyncDelete).toHaveBeenCalledTimes(1);
    expect(mockChildSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        primaryButton: expect.objectContaining({
          label: 'Deleting...',
          disabled: true,
        }),
      }),
    );
    expect(mockSheetClose).not.toHaveBeenCalled();

    // 3. Resolve the promise rejection
    await act(async () => {
      jest.runAllTimers();
    });

    // 4. Check final state
    expect(mockSheetClose).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Delete error:', deleteError);
    expect(mockChildSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        primaryButton: expect.objectContaining({
          label: 'Delete',
          disabled: false,
          loading: false,
        }),
      }),
    );
  });
});
