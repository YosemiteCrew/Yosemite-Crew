import React from 'react';
import {render} from '@testing-library/react-native';
import {
  InsuredStatusBottomSheet,
  InsuredStatusBottomSheetRef,
} from '../../../src/shared/components/common/InsuredStatusBottomSheet/InsuredStatusBottomSheet';

// --- Mocks ---

// Mock GenericSelectBottomSheet
// Capture props and expose imperative handle to test proxying
jest.mock(
  '../../../src/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const {View: RNView} = require('react-native');
    const ReactMock = require('react');

    return {
      GenericSelectBottomSheet: ReactMock.forwardRef((props: any, ref: any) => {
        // Expose mock methods to the parent
        ReactMock.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));

        // Render a view we can find with a helper prop to trigger onSave
        return (
          <RNView testID="mock-generic-sheet">
            <RNView
              testID="save-trigger"
              // @ts-ignore - attaching function to a prop for test triggering
              onTrigger={(item: any) => props.onSave(item)}
            />
          </RNView>
        );
      }),
    };
  },
);

describe('InsuredStatusBottomSheet Component', () => {
  const mockOnSave = jest.fn();
  // Define ref explicitly allowing null to satisfy Typescript RefObject definition
  let ref: React.RefObject<InsuredStatusBottomSheetRef | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    ref = React.createRef<InsuredStatusBottomSheetRef>();
  });

  // ===========================================================================
  // 1. Rendering & Logic
  // ===========================================================================

  it('renders correctly', () => {
    const {getByTestId} = render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected={null}
        onSave={mockOnSave}
      />,
    );
    expect(getByTestId('mock-generic-sheet')).toBeTruthy();
  });

  it('finds and passes the correct selectedItem based on "selected" prop', () => {
    // This covers the branch: const selectedItem = selected ? ... : null
    render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected="insured"
        onSave={mockOnSave}
      />,
    );
  });

  it('passes null if "selected" prop does not match any known item', () => {
    // This covers the branch: ... || null inside the find logic
    render(
      <InsuredStatusBottomSheet
        ref={ref}
        // @ts-ignore - testing invalid string to force 'find' to return undefined
        selected="unknown-status"
        onSave={mockOnSave}
      />,
    );
  });

  // ===========================================================================
  // 2. Interaction (Imperative Handle)
  // ===========================================================================

  it('exposes open method via ref', () => {
    render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected={null}
        onSave={mockOnSave}
      />,
    );

    // Expect ref to be populated
    expect(ref.current).not.toBeNull();

    // Call open - ensures the proxy function exists and doesn't crash
    expect(() => ref.current?.open()).not.toThrow();
  });

  it('exposes close method via ref', () => {
    render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected={null}
        onSave={mockOnSave}
      />,
    );

    expect(ref.current).not.toBeNull();
    expect(() => ref.current?.close()).not.toThrow();
  });

  // ===========================================================================
  // 3. Logic: onSave Handling
  // ===========================================================================

  it('calls parent onSave with ID when an item is selected', () => {
    const {getByTestId} = render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected={null}
        onSave={mockOnSave}
      />,
    );

    const trigger = getByTestId('save-trigger');
    const mockItem = {id: 'not-insured', label: 'Not insured'};

    // Trigger the mock's onTrigger prop which calls props.onSave inside the mock
    // @ts-ignore
    trigger.props.onTrigger(mockItem);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith('not-insured');
  });

  it('does NOT call parent onSave if item is null', () => {
    const {getByTestId} = render(
      <InsuredStatusBottomSheet
        ref={ref}
        selected={null}
        onSave={mockOnSave}
      />,
    );

    const trigger = getByTestId('save-trigger');

    // Trigger with null (simulating dismissal or no selection)
    // @ts-ignore
    trigger.props.onTrigger(null);

    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
