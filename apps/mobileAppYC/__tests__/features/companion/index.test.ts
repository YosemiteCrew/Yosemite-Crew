import * as CompanionIndex from '../../../src/features/companion/index';

describe('features/companion/index', () => {
  it('should export all modules correctly', () => {
    expect(CompanionIndex.companionReducer).toBeDefined();
    expect(CompanionIndex.setSelectedCompanion).toBeDefined();
    expect(CompanionIndex.clearCompanionError).toBeDefined();
    expect(CompanionIndex.resetCompanionState).toBeDefined();
    expect(CompanionIndex.updateCompanion).toBeDefined();
    expect(CompanionIndex.removeCompanion).toBeDefined();
    expect(CompanionIndex.addCompanion).toBeDefined();
    expect(CompanionIndex.fetchCompanions).toBeDefined();
    expect(CompanionIndex.selectCompanionState).toBeDefined();
    expect(CompanionIndex.selectCompanions).toBeDefined();
    expect(CompanionIndex.selectSelectedCompanionId).toBeDefined();
    expect(CompanionIndex.selectSelectedCompanion).toBeDefined();
    expect(CompanionIndex.selectCompanionLoading).toBeDefined();
    expect(CompanionIndex.selectCompanionError).toBeDefined();
    expect(CompanionIndex.selectCompanionsByCategory).toBeDefined();
  });
});