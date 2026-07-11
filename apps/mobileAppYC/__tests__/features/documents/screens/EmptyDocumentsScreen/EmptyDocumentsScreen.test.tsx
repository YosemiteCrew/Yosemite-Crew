import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {EmptyDocumentsScreen} from '@/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

const mockHandleAddDocument = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

jest.mock('@/features/documents/hooks/useDocumentNavigation', () => ({
  useDocumentNavigation: () => ({handleAddDocument: mockHandleAddDocument}),
}));

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text} = require('react-native');
  return {
    Header: ({title, showBackButton}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        {showBackButton ? <Text>Back</Text> : null}
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="screen-layout">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

describe('EmptyDocumentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the warm-bone empty state with the design copy', () => {
    const {getByText, getByTestId} = render(<EmptyDocumentsScreen />);

    expect(getByText('Documents')).toBeTruthy();
    expect(getByTestId('empty-documents')).toBeTruthy();
    expect(getByText('Nothing in the drawer yet')).toBeTruthy();
    expect(
      getByText(
        'Insurance papers, lab results and adoption records will live here, together and searchable.',
      ),
    ).toBeTruthy();
    expect(getByText('Add first document')).toBeTruthy();
  });

  it('does not render a back button (tab root)', () => {
    const {queryByText} = render(<EmptyDocumentsScreen />);
    expect(queryByText('Back')).toBeNull();
  });

  it('navigates to add a document when the CTA is pressed', () => {
    const {getByTestId} = render(<EmptyDocumentsScreen />);

    fireEvent.press(getByTestId('empty-documents-action'));

    expect(mockHandleAddDocument).toHaveBeenCalledTimes(1);
  });
});
