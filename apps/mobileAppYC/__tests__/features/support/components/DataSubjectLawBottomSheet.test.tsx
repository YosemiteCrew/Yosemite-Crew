import React from 'react';
import {render, act} from '@testing-library/react-native';
import {
  DataSubjectLawBottomSheet,
  DataSubjectLawBottomSheetRef,
} from '../../../../src/features/support/components/DataSubjectLawBottomSheet';

// --- Mocks ---

// 1. Mock Data
jest.mock('../../../../src/features/support/data/contactData', () => ({
  DSAR_LAW_OPTIONS: [
    {id: 'law-1', label: 'GDPR'},
    {id: 'law-2', label: 'CCPA'},
  ],
}));

// 2. Mock Child Component (GenericSelectBottomSheet)
// We need to mock this as a forwardRef to capture the `open`/`close` calls delegated to it.
const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();

jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const {forwardRef, useImperativeHandle} = require('react');
    const {View} = require('react-native');

    return {
      GenericSelectBottomSheet: forwardRef((props: any, ref: any) => {
        // Expose methods to the parent (DataSubjectLawBottomSheet) via the ref it passes down
        useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));

        // Render a view with testID to find it, and pass props through for inspection
        return <View testID="generic-sheet" {...props} />;
      }),
    };
  },
);

describe('DataSubjectLawBottomSheet', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and maps data options to items', () => {
    const {getByTestId} = render(
      <DataSubjectLawBottomSheet
        selectedLawId={null}
        onSelect={mockOnSelect}
      />,
    );

    const sheet = getByTestId('generic-sheet');

    // Check if title is correct
    expect(sheet.props.title).toBe('Select regulation');

    // Check if data mapping is correct (DSAR_LAW_OPTIONS -> items)
    expect(sheet.props.items).toEqual([
      {id: 'law-1', label: 'GDPR'},
      {id: 'law-2', label: 'CCPA'},
    ]);
  });

  it('calculates selectedItem correctly when selectedLawId is provided', () => {
    const {getByTestId} = render(
      <DataSubjectLawBottomSheet
        selectedLawId="law-2"
        onSelect={mockOnSelect}
      />,
    );

    const sheet = getByTestId('generic-sheet');
    // Should find the item corresponding to law-2
    expect(sheet.props.selectedItem).toEqual({id: 'law-2', label: 'CCPA'});
  });

  it('sets selectedItem to null when selectedLawId is null', () => {
    const {getByTestId} = render(
      <DataSubjectLawBottomSheet
        selectedLawId={null}
        onSelect={mockOnSelect}
      />,
    );

    const sheet = getByTestId('generic-sheet');
    expect(sheet.props.selectedItem).toBeNull();
  });

  it('sets selectedItem to null when selectedLawId does not exist in options', () => {
    const {getByTestId} = render(
      <DataSubjectLawBottomSheet
        selectedLawId="unknown-law"
        onSelect={mockOnSelect}
      />,
    );

    const sheet = getByTestId('generic-sheet');
    expect(sheet.props.selectedItem).toBeNull();
  });

  it('forwards open and close methods to the internal sheet ref', async () => {
    const ref = React.createRef<DataSubjectLawBottomSheetRef>();

    render(
      <DataSubjectLawBottomSheet
        ref={ref}
        selectedLawId={null}
        onSelect={mockOnSelect}
      />,
    );

    // 1. Test open
    await act(async () => {
      ref.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    // 2. Test close
    await act(async () => {
      ref.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('passes the onSelect callback to onSave prop of GenericSelectBottomSheet', () => {
    const {getByTestId} = render(
      <DataSubjectLawBottomSheet
        selectedLawId={null}
        onSelect={mockOnSelect}
      />,
    );

    const sheet = getByTestId('generic-sheet');
    // Simulate saving from the generic sheet
    const testOption = {id: 'law-1', label: 'GDPR'};
    sheet.props.onSave(testOption);

    expect(mockOnSelect).toHaveBeenCalledWith(testOption);
  });
});
