import { renderHook } from '@testing-library/react';
import {
  useLoadCompanionsForPrimaryOrg,
  useCompanionsForPrimaryOrg,
  useCompanionsParentsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useParentStore } from '@/app/stores/parentStore';
import {
  StoredCompanion,
  CompanionParent,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';

// --- Mocks ---

// 1. Mock Service
jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: jest.fn(),
}));

// 2. Mock Stores
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock('@/app/stores/parentStore', () => ({ useParentStore: jest.fn() }));

const mockCompanionGetState = jest.fn();

describe('useCompanion Hooks', () => {
  // Mutable state for mocks
  let mockOrgState: { primaryOrgId: string | null };
  let mockCompanionState: {
    companionsById: Record<string, StoredCompanion>;
    companionsIdsByOrgId: Record<string, string[]>;
  };
  let mockParentState: {
    parentsById: Record<string, StoredParent>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default state
    mockOrgState = { primaryOrgId: null };
    mockCompanionState = {
      companionsById: {},
      companionsIdsByOrgId: {},
    };
    mockParentState = {
      parentsById: {},
    };

    // Implement store mocks to read from mutable state
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => selector(mockOrgState));
    (useCompanionStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockCompanionState)
    );
    mockCompanionGetState.mockReturnValue(mockCompanionState);
    (useCompanionStore as unknown as jest.Mock & { getState: jest.Mock }).getState =
      mockCompanionGetState;
    (useParentStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockParentState)
    );
  });

  // --- Section 1: useLoadCompanionsForPrimaryOrg ---
  describe('useLoadCompanionsForPrimaryOrg', () => {
    it('does nothing when primaryOrgId is missing', () => {
      mockOrgState.primaryOrgId = null;
      renderHook(() => useLoadCompanionsForPrimaryOrg());
      expect(loadCompanionsForPrimaryOrg).not.toHaveBeenCalled();
    });

    it('triggers loadCompanionsForPrimaryOrg when org is present', () => {
      mockOrgState.primaryOrgId = 'org-1';
      renderHook(() => useLoadCompanionsForPrimaryOrg());
      expect(loadCompanionsForPrimaryOrg).toHaveBeenCalledTimes(1);
      expect(loadCompanionsForPrimaryOrg).toHaveBeenCalledWith();
    });

    it('re-triggers when primaryOrgId changes', () => {
      mockOrgState.primaryOrgId = 'org-1';
      const { rerender } = renderHook(() => useLoadCompanionsForPrimaryOrg());
      expect(loadCompanionsForPrimaryOrg).toHaveBeenCalledTimes(1);

      mockOrgState.primaryOrgId = 'org-2';
      rerender();
      expect(loadCompanionsForPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useCompanionsForPrimaryOrg ---
  describe('useCompanionsForPrimaryOrg', () => {
    const mockComp1 = { id: 'comp-1', name: 'Doggy' } as unknown as StoredCompanion;

    it('returns empty array if primaryOrgId is missing', () => {
      mockOrgState.primaryOrgId = null;
      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-1'];
      mockCompanionState.companionsById['comp-1'] = mockComp1;

      const { result } = renderHook(() => useCompanionsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it('returns empty array if org has no companions indexed', () => {
      mockOrgState.primaryOrgId = 'org-empty';
      const { result } = renderHook(() => useCompanionsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it('returns mapped companions for the primary org', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-1'];
      mockCompanionState.companionsById = { 'comp-1': mockComp1 };

      const { result } = renderHook(() => useCompanionsForPrimaryOrg());
      expect(result.current).toEqual([mockComp1]);
    });

    it('filters out missing/null companions (robustness check)', () => {
      mockOrgState.primaryOrgId = 'org-1';
      // comp-2 exists in ID list but not in ById map
      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-1', 'comp-2'];
      mockCompanionState.companionsById = { 'comp-1': mockComp1 };

      const { result } = renderHook(() => useCompanionsForPrimaryOrg());
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockComp1);
    });
  });

  // --- Section 3: useCompanionsParentsForPrimaryOrg ---
  describe('useCompanionsParentsForPrimaryOrg', () => {
    // FIX: Cast partial mock to StoredParent to satisfy TypeScript
    const mockParent = {
      id: 'par-1',
      firstName: 'John',
      name: 'John Doe',
    } as unknown as StoredParent;

    const mockComp = {
      id: 'comp-1',
      parentId: 'par-1',
      name: 'Rex',
    } as unknown as StoredCompanion;

    it('returns empty array if primaryOrgId is missing', () => {
      mockOrgState.primaryOrgId = null;
      const { result } = renderHook(() => useCompanionsParentsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it('joins companion and parent data correctly', () => {
      mockOrgState.primaryOrgId = 'org-1';

      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-1'];
      mockCompanionState.companionsById = { 'comp-1': mockComp };

      mockParentState.parentsById = { 'par-1': mockParent };

      const { result } = renderHook(() => useCompanionsParentsForPrimaryOrg());

      const expected: CompanionParent = { companion: mockComp, parent: mockParent };
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(expected);
    });

    it('filters out companions if the parent is not found', () => {
      mockOrgState.primaryOrgId = 'org-1';

      // Companion exists, but points to non-existent parent
      const orphanComp = {
        id: 'comp-orphan',
        parentId: 'par-missing',
      } as unknown as StoredCompanion;

      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-orphan'];
      mockCompanionState.companionsById = { 'comp-orphan': orphanComp };
      mockParentState.parentsById = { 'par-1': mockParent }; // unrelated parent

      const { result } = renderHook(() => useCompanionsParentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it('filters out null companions before checking parent', () => {
      mockOrgState.primaryOrgId = 'org-1';
      // ID exists in index, but object missing in map
      mockCompanionState.companionsIdsByOrgId['org-1'] = ['comp-missing'];
      mockCompanionState.companionsById = {};

      const { result } = renderHook(() => useCompanionsParentsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });
  });
});
