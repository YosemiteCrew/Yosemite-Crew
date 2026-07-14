import {renderHook, act} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';
import * as Redux from 'react-redux';
import {
  useFormScreen,
  useCompanionFormScreen,
  useFormFileOperations,
} from '@/shared/hooks/useFormScreen';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockNavigation = {
  canGoBack: jest.fn(),
  goBack: jest.fn(),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

const mockFormSheets = {
  openSheet: jest.fn(),
  closeSheet: jest.fn(),
  refs: {deleteSheetRef: {current: null}},
};
jest.mock('@/shared/hooks/useFormBottomSheets', () => ({
  useFormBottomSheets: () => mockFormSheets,
}));

const mockFileOperationsResult = {handleTakePhoto: jest.fn()};
const mockUseFileOperations = jest.fn(() => mockFileOperationsResult);
jest.mock('@/shared/hooks/useFileOperations', () => ({
  useFileOperations: (...args: any[]) => mockUseFileOperations(...args),
}));

const mockDispatch = jest.fn();

describe('useFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
  });

  it('returns theme, dispatch, navigation, formSheets and initial unsaved-changes state', () => {
    const {result} = renderHook(() => useFormScreen());

    expect(result.current.theme).toBe(mockTheme);
    expect(result.current.dispatch).toBe(mockDispatch);
    expect(result.current.navigation).toBe(mockNavigation);
    expect(result.current.formSheets).toBe(mockFormSheets);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('markAsChanged sets hasUnsavedChanges to true', () => {
    const {result} = renderHook(() => useFormScreen());

    act(() => {
      result.current.markAsChanged();
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('handleGoBack opens the discard sheet when there are unsaved changes', () => {
    const {result} = renderHook(() => useFormScreen());
    const openSpy = jest.fn();
    (result.current.discardSheetRef as any).current = {open: openSpy};

    act(() => {
      result.current.markAsChanged();
    });
    act(() => {
      result.current.handleGoBack();
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('handleGoBack navigates back when there are no unsaved changes and navigation can go back', () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    const {result} = renderHook(() => useFormScreen());

    act(() => {
      result.current.handleGoBack();
    });

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('handleGoBack does nothing when there are no unsaved changes and navigation cannot go back', () => {
    mockNavigation.canGoBack.mockReturnValue(false);
    const {result} = renderHook(() => useFormScreen());

    act(() => {
      result.current.handleGoBack();
    });

    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });
});

describe('useCompanionFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
  });

  it('merges companions and selectedCompanionId from redux state onto the form screen result', () => {
    jest.spyOn(Redux, 'useSelector').mockImplementation((selectorFn: any) =>
      selectorFn({
        companion: {
          companions: [{id: 'c1', name: 'Rex'}],
          selectedCompanionId: 'c1',
        },
      }),
    );

    const {result} = renderHook(() => useCompanionFormScreen());

    expect(result.current.companions).toEqual([{id: 'c1', name: 'Rex'}]);
    expect(result.current.selectedCompanionId).toBe('c1');
    expect(result.current.theme).toBe(mockTheme);
  });
});

describe('useFormFileOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires setFiles, clearError, and sheet handlers through to useFileOperations', () => {
    const onFormChange = jest.fn();
    const onErrorClear = jest.fn();
    const files = [{id: 'f1'}];

    const {result} = renderHook(() =>
      useFormFileOperations(
        files,
        'attachments',
        onFormChange,
        onErrorClear,
        mockFormSheets as any,
      ),
    );

    expect(result.current).toBe(mockFileOperationsResult);
    const configArg = mockUseFileOperations.mock.calls[0][0];
    expect(configArg.files).toBe(files);
    expect(configArg.openSheet).toBe(mockFormSheets.openSheet);
    expect(configArg.closeSheet).toBe(mockFormSheets.closeSheet);
    expect(configArg.deleteSheetRef).toBe(mockFormSheets.refs.deleteSheetRef);

    configArg.setFiles(['new-file']);
    expect(onFormChange).toHaveBeenCalledWith('attachments', ['new-file']);

    configArg.clearError();
    expect(onErrorClear).toHaveBeenCalledWith('attachments');
  });
});
