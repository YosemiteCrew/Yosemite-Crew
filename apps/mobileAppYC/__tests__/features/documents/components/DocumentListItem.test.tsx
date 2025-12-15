import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import DocumentListItem from '../../../../src/features/documents/components/DocumentListItem';

// --- Mocks ---

// Mock the child DocumentCard to inspect props passed to it and simulate interactions
jest.mock('@/shared/components/common/DocumentCard/DocumentCard', () => {
  const {View, Button, Text} = require('react-native');
  return (props: any) => (
    <View testID="mock-card">
      <Text>{props.title}</Text>
      {/* Simulate the card's view action button */}
      <Button testID="btn-view" title="View" onPress={props.onPressView} />
      {/* Simulate pressing the card body itself */}
      <Button
        testID="btn-card-press"
        title="Card Press"
        onPress={props.onPress}
      />
      {/* Simulate the edit action if visible and enabled */}
      {props.showEditAction && props.onPressEdit ? (
        <Button testID="btn-edit" title="Edit" onPress={props.onPressEdit} />
      ) : null}
    </View>
  );
});

describe('DocumentListItem', () => {
  const mockOnView = jest.fn();
  const mockOnEdit = jest.fn();

  const baseDocument = {
    id: 'doc-123',
    title: 'Test Document',
    businessName: 'Vet Clinic',
    visitType: 'Checkup',
    issueDate: '2023-01-01',
    isUserAdded: true,
    uploadedByPmsUserId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic Rendering & View Interaction ---

  it('renders basic document info and handles view actions', () => {
    const {getByText, getByTestId} = render(
      <DocumentListItem
        document={baseDocument as any}
        onPressView={mockOnView}
      />,
    );

    expect(getByText('Test Document')).toBeTruthy();

    // 1. Test "View" Action Button
    fireEvent.press(getByTestId('btn-view'));
    expect(mockOnView).toHaveBeenCalledWith('doc-123');

    // 2. Test Card Body Press (also mapped to view)
    fireEvent.press(getByTestId('btn-card-press'));
    expect(mockOnView).toHaveBeenCalledTimes(2);
  });

  // --- 2. Edit Logic (Branch Coverage) ---

  it('enables edit when document is user-added and NOT uploaded by PMS', () => {
    const doc = {...baseDocument, isUserAdded: true, uploadedByPmsUserId: null};

    const {getByTestId} = render(
      <DocumentListItem
        document={doc as any}
        onPressView={mockOnView}
        onPressEdit={mockOnEdit}
      />,
    );

    const editBtn = getByTestId('btn-edit');
    expect(editBtn).toBeTruthy();

    fireEvent.press(editBtn);
    expect(mockOnEdit).toHaveBeenCalledWith('doc-123');
  });

  it('disables edit when document is NOT user-added', () => {
    const doc = {
      ...baseDocument,
      isUserAdded: false,
      uploadedByPmsUserId: null,
    };

    const {queryByTestId} = render(
      <DocumentListItem
        document={doc as any}
        onPressView={mockOnView}
        onPressEdit={mockOnEdit}
      />,
    );

    // Edit button should not be rendered
    expect(queryByTestId('btn-edit')).toBeNull();
  });

  it('disables edit when document has a PMS uploader ID (even if user added)', () => {
    // This logic branch: !document.uploadedByPmsUserId
    const doc = {
      ...baseDocument,
      isUserAdded: true,
      uploadedByPmsUserId: 'pms-user-1',
    };

    const {queryByTestId} = render(
      <DocumentListItem
        document={doc as any}
        onPressView={mockOnView}
        onPressEdit={mockOnEdit}
      />,
    );

    expect(queryByTestId('btn-edit')).toBeNull();
  });

  it('disables edit if onPressEdit prop is not provided', () => {
    // Document is editable, but parent didn't pass the handler
    const doc = {...baseDocument, isUserAdded: true, uploadedByPmsUserId: null};

    const {queryByTestId} = render(
      <DocumentListItem
        document={doc as any}
        onPressView={mockOnView}
        // onPressEdit is undefined
      />,
    );

    expect(queryByTestId('btn-edit')).toBeNull();
  });
});
