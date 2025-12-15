import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {
  BreedBottomSheet,
  type BreedBottomSheetRef,
} from '@/shared/components/common/BreedBottomSheet/BreedBottomSheet';
// We don't import the real type, as we will mock it locally to match the component's usage
// import type { Breed } from '@/features/companion/types';

// --- Mocks ---

// This is the main mock we'll use to spy on the props passed to GenericSelectBottomSheet
const mockGenericSelectBottomSheet = jest.fn();

// Mock functions for the internal BottomSheet ref
const mockOpen = jest.fn();
const mockClose = jest.fn();

// Mock the child GenericSelectBottomSheet
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactActual = jest.requireActual('react');
    const {View: RNView} = jest.requireActual('react-native');

    return {
      GenericSelectBottomSheet: ReactActual.forwardRef((props: any, ref: any) => {
        // Expose mock methods for useImperativeHandle
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockOpen,
          close: mockClose,
        }));

        // Call our spy function with the received props
        mockGenericSelectBottomSheet(props);

        // Render a placeholder we can interact with
        return (
          <RNView
            testID="mock-generic-bottom-sheet"
            // Helper to simulate the onSave prop being called
            save={(item: any) => props.onSave(item)}
          />
        );
      }),
    };
  },
);

// --- Test Setup ---

// FIX: Define a local Breed type that matches the component's props
// This adds the missing 'speciesId' and 'speciesName' properties
type MockBreed = {
  breedId: number;
  breedName: string;
  speciesId: number;
  speciesName: string;
};

// Use the full MockBreed type
const mockBreeds: MockBreed[] = [
  {
    breedId: 1,
    breedName: 'Golden Retriever',
    speciesId: 1,
    speciesName: 'Dog',
  },
  {breedId: 2, breedName: 'Siamese', speciesId: 2, speciesName: 'Cat'},
];

// Create the expected 'SelectItem' array
const mockBreedItems = [
  {id: '1', label: 'Golden Retriever', ...mockBreeds[0]},
  {id: '2', label: 'Siamese', ...mockBreeds[1]},
];

describe('BreedBottomSheet', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes static props to GenericSelectBottomSheet', () => {
    render(
      <BreedBottomSheet breeds={[]} selectedBreed={null} onSave={mockOnSave} />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Select breed',
        searchPlaceholder: 'Search from 200+ breeds',
        emptyMessage: 'No breeds available',
        mode: 'select',
        snapPoints: ['95%', '98%'],
      }),
    );
  });

  it('transforms the breeds prop into items for the child', () => {
    render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={null}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: mockBreedItems,
      }),
    );
  });

  it('passes an empty array if breeds prop is empty', () => {
    render(
      <BreedBottomSheet breeds={[]} selectedBreed={null} onSave={mockOnSave} />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [],
      }),
    );
  });

  it('transforms the selectedBreed prop into selectedItem', () => {
    render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={mockBreeds[0]}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: mockBreedItems[0],
      }),
    );
  });

  it('passes selectedItem as null if selectedBreed is null', () => {
    render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={null}
        onSave={mockOnSave}
      />,
    );

    expect(mockGenericSelectBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedItem: null,
      }),
    );
  });

  it('calls onSave with the full Breed object when an item is saved', () => {
    const {getByTestId} = render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={null}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');

    // Simulate the child calling onSave with the transformed SelectItem
    fireEvent(childSheet, 'save', mockBreedItems[1]);

    // Expect the parent onSave to be called with the *original* Breed object
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(mockBreeds[1]);
  });

  it('calls onSave with null when null is saved', () => {
    const {getByTestId} = render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={mockBreeds[0]}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    fireEvent(childSheet, 'save', null);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('calls onSave with null if the saved item id is not in the breeds list', () => {
    const {getByTestId} = render(
      <BreedBottomSheet
        breeds={mockBreeds}
        selectedBreed={null}
        onSave={mockOnSave}
      />,
    );

    const childSheet = getByTestId('mock-generic-bottom-sheet');
    const unknownItem = {id: '999', label: 'Unknown Breed'};

    fireEvent(childSheet, 'save', unknownItem);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(null);
  });

  it('exposes an open method via its ref', () => {
    const ref = React.createRef<BreedBottomSheetRef>();
    render(
      <BreedBottomSheet
        breeds={[]}
        selectedBreed={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    ref.current?.open();
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('exposes a close method via its ref', () => {
    const ref = React.createRef<BreedBottomSheetRef>();
    render(
      <BreedBottomSheet
        breeds={[]}
        selectedBreed={null}
        onSave={mockOnSave}
        ref={ref}
      />,
    );

    ref.current?.close();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
