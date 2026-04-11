import { renderHook } from '@testing-library/react-native';
import { useDispatch } from 'react-redux';
import { useAutoSelectCompanion } from '../../../src/shared/hooks/useAutoSelectCompanion';
import { setSelectedCompanion } from '../../../src/features/companion';

// --- Mocks ---

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('../../../src/features/companion', () => ({
  setSelectedCompanion: jest.fn((id) => ({ type: 'companion/setSelected', payload: id })),
}));

describe('useAutoSelectCompanion', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
  });

  // =========================================================================
  // 1. Selection Logic (Dispatch)
  // =========================================================================
  describe('Selection Logic', () => {
    it('dispatches action with "id" when no companion selected', () => {
      const companions = [{ id: 'comp-1', name: 'Buddy' }];

      renderHook(() => useAutoSelectCompanion(companions, null));

      expect(setSelectedCompanion).toHaveBeenCalledWith('comp-1');
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'companion/setSelected',
        payload: 'comp-1',
      });
    });

    it('falls back to "_id" if "id" is missing', () => {
      const companions = [{ _id: 'mongo-id-123', name: 'Mongo Pet' }];

      renderHook(() => useAutoSelectCompanion(companions, undefined));

      expect(setSelectedCompanion).toHaveBeenCalledWith('mongo-id-123');
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('falls back to identifier array if other IDs are missing', () => {
      const companions = [{ identifier: [{ value: 'fhir-id-99' }] }];

      renderHook(() => useAutoSelectCompanion(companions, null));

      expect(setSelectedCompanion).toHaveBeenCalledWith('fhir-id-99');
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Skip Logic (No Dispatch)
  // =========================================================================
  describe('Skip Logic', () => {
    it('does NOT dispatch if a companion is already selected', () => {
      const companions = [{ id: 'comp-1' }];
      const selectedId = 'comp-1';

      renderHook(() => useAutoSelectCompanion(companions, selectedId));

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('does NOT dispatch if companions list is empty', () => {
      const companions: any[] = [];

      renderHook(() => useAutoSelectCompanion(companions, null));

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('does NOT dispatch if first companion has no resolvable ID', () => {
      // Object has no id, _id, or identifier
      const companions = [{ name: 'Ghost Pet' }];

      renderHook(() => useAutoSelectCompanion(companions, null));

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});