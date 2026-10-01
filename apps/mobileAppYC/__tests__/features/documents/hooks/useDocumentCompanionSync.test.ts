import {renderHook, waitFor} from '@testing-library/react-native';
import {useDocumentCompanionSync} from '@/features/documents/hooks/useDocumentCompanionSync';

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn((id: string) => ({
    type: 'companion/setSelected',
    payload: id,
  })),
}));

jest.mock('@/features/documents/documentSlice', () => ({
  fetchDocuments: jest.fn((args: {companionId: string}) => ({
    type: 'documents/fetch',
    payload: args,
  })),
}));

describe('useDocumentCompanionSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects the first companion when none is selected', () => {
    const dispatch = jest.fn();

    renderHook(() =>
      useDocumentCompanionSync({
        companions: [{id: 'c1'}, {id: 'c2'}],
        selectedCompanionId: null,
        dispatch,
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: 'companion/setSelected',
      payload: 'c1',
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does nothing without companions or a selection', () => {
    const dispatch = jest.fn();

    renderHook(() =>
      useDocumentCompanionSync({
        companions: [],
        selectedCompanionId: null,
        dispatch,
      }),
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fetches documents for the selected companion', () => {
    const dispatch = jest.fn();

    renderHook(() =>
      useDocumentCompanionSync({
        companions: [{id: 'c1'}],
        selectedCompanionId: 'c1',
        dispatch,
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: 'documents/fetch',
      payload: {companionId: 'c1'},
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('logs a failed document fetch instead of leaving it unhandled', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dispatch = jest.fn(() => Promise.reject(new Error('fetch failed')));

    renderHook(() =>
      useDocumentCompanionSync({
        companions: [{id: 'c1'}],
        selectedCompanionId: 'c1',
        dispatch: dispatch as any,
      }),
    );

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        '[Background] Task failed',
        expect.stringContaining('Error: fetch failed'),
      ),
    );
    warnSpy.mockRestore();
  });
});
