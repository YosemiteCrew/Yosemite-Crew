import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {DocumentsScreen} from '@/features/documents/screens/DocumentsScreen/DocumentsScreen';

const mockDispatch = jest.fn();
let mockCompanions: any[] = [];
let mockCompanionLoadError: string | undefined;
let mockParentId: string | undefined = 'parent-1';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../../../../setup/mockTheme');
  return {__esModule: true, useTheme: jest.fn(() => ({theme, isDark: false}))};
});

jest.mock('@/shared/hooks/useFormScreen', () => {
  const {mockTheme: theme} = require('../../../../setup/mockTheme');
  return {
    useCompanionFormScreen: () => ({
      theme,
      dispatch: mockDispatch,
      companions: mockCompanions,
      selectedCompanionId: mockCompanions[0]?.id ?? null,
    }),
  };
});

jest.mock('react-redux', () => ({
  useSelector: (selector: any) =>
    selector({
      companion: {loadError: mockCompanionLoadError},
      auth: {user: {parentId: mockParentId}},
      documents: {documents: []},
    }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

jest.mock('@/features/documents/hooks/useDocumentCompanionSync', () => ({
  useDocumentCompanionSync: jest.fn(),
}));

jest.mock('@/features/documents/hooks/useDocumentNavigation', () => ({
  useDocumentNavigation: () => ({
    handleAddDocument: jest.fn(),
    handleDocumentPress: jest.fn(),
  }),
}));

jest.mock('@/shared/utils/screenStyles', () => ({
  useCommonScreenStyles: () => ({}),
}));

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const RN = jest.requireActual('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <RN.View testID="screen-shell">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </RN.View>
      ),
    };
  },
);

jest.mock('@/features/documents/components/DocumentsListHeader', () => {
  const RN = jest.requireActual('react-native');
  return {DocumentsListHeader: () => <RN.View testID="documents-header" />};
});

jest.mock(
  '../../../../../src/features/documents/screens/EmptyDocumentsScreen/EmptyDocumentsScreen',
  () => {
    const RN = jest.requireActual('react-native');
    return {EmptyDocumentsScreen: () => <RN.View testID="documents-empty" />};
  },
);

jest.mock('@/shared/components/common/ListErrorState/ListErrorState', () => {
  const RN = jest.requireActual('react-native');
  return {
    ListErrorState: ({testID, onRetry}: any) => (
      <RN.TouchableOpacity testID={testID} onPress={onRetry} />
    ),
  };
});

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const RN = jest.requireActual('react-native');
    return {CompanionSelector: () => <RN.View testID="companion-selector" />};
  },
);

jest.mock('@/shared/components/common/CategoryTile/CategoryTile', () => {
  const RN = jest.requireActual('react-native');
  return {CategoryTile: () => <RN.View />};
});

jest.mock('@/features/documents/components/DocumentListItem', () => {
  const RN = jest.requireActual('react-native');
  return {__esModule: true, default: () => <RN.View />};
});

describe('DocumentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanions = [];
    mockCompanionLoadError = undefined;
    mockParentId = 'parent-1';
  });

  it('shows the new-user empty screen when there are genuinely no companions', () => {
    const {getByTestId, queryByTestId} = render(<DocumentsScreen />);

    expect(getByTestId('documents-empty')).toBeTruthy();
    expect(queryByTestId('documents-companions-load-error')).toBeNull();
  });

  // A failed companion fetch is not an account with no companions.
  it('shows a retry state when the companion fetch failed', () => {
    mockCompanionLoadError = 'Network Error';

    const {getByTestId, queryByTestId} = render(<DocumentsScreen />);

    expect(getByTestId('documents-companions-load-error')).toBeTruthy();
    expect(queryByTestId('documents-empty')).toBeNull();
  });

  // Returned bare, the error lost the header, safe-area inset and background,
  // so on a device with a top inset it could start under the status bar.
  it('keeps the standard screen shell around the error state', () => {
    mockCompanionLoadError = 'Network Error';

    const {getByTestId} = render(<DocumentsScreen />);

    expect(getByTestId('screen-shell')).toBeTruthy();
    expect(getByTestId('documents-header')).toBeTruthy();
  });

  it('retries the companion fetch when the error state is pressed', () => {
    mockCompanionLoadError = 'Network Error';
    const {getByTestId} = render(<DocumentsScreen />);

    fireEvent.press(getByTestId('documents-companions-load-error'));

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('does not dispatch a retry when there is no parent id', () => {
    mockCompanionLoadError = 'Network Error';
    mockParentId = undefined;
    const {getByTestId} = render(<DocumentsScreen />);

    fireEvent.press(getByTestId('documents-companions-load-error'));

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
