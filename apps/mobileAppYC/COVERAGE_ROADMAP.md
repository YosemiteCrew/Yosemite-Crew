# Coverage Improvement Roadmap for mobileAppYC

## Current Status (as of latest run)
- **Overall Coverage**: 42.16% lines
- **Target**: 90% lines
- **Gap**: 47.84% (~1,820 lines to cover)
- **Tests Passing**: 51 suites, 602 tests

## Quick Win Files (Add these tests first for maximum impact)

### Priority 1: Bottom Sheets (Currently 3-20% coverage each)
All use similar patterns - create one template and replicate:

1. `AddressBottomSheet.tsx` - 3.15% (Lines: 47-308)
2. `ProfileImagePicker.tsx` - 3.7% (Lines: 43-276)
3. `CurrencyBottomSheet.tsx` - 7.69% (Lines: 47-195)
4. `GenericSelectBottomSheet.tsx` - 6.97% (Lines: 60-197)
5. `BloodGroupBottomSheet.tsx` - 17.64% (Lines: 53-83)
6. `BreedBottomSheet.tsx` - 12.5% (Lines: 21-53)
7. `CategoryBottomSheet.tsx` - 18.75% (Lines: 27-53)
8. `CountryBottomSheet.tsx` - 12.5% (Lines: 27-57)
9. `CountryMobileBottomSheet.tsx` - 12% (Lines: 31-93)
10. `GenderBottomSheet.tsx` - 14.28% (Lines: 17-43)
11. `InsuredStatusBottomSheet.tsx` - 14.28% (Lines: 14-40)
12. `NeuteredStatusBottomSheet.tsx` - 14.28% (Lines: 14-40)
13. `OriginBottomSheet.tsx` - 14.28% (Lines: 17-46)

**Est. Coverage Gain**: ~8-12% if all bottom sheets tested

### Priority 2: Cards & Display Components (Currently 10-30%)
1. `DocumentCard.tsx` - 11.11% (Lines: 19-23, 49-129)
2. `CategoryTile.tsx` - 28.57% (Lines: 31-34)
3. `AppointmentCard.tsx` - 12.5% (Lines: 39-75)
4. `InlineEditRow.tsx` - 9.52% (Lines: 27-62)
5. `YearlySpendCard.tsx` - 10%
6. `CompanionSelector.tsx` - 14.28% (Lines: 45-105)

**Est. Coverage Gain**: ~4-6%

### Priority 3: Screens (Currently 0-15%)
These are harder but necessary for 90%:
1. Document screens (AddDocument, EditDocument, CategoryDetail, DocumentPreview)
2. Companion screens (AddCompanion, ProfileOverview, CompanionOverview)
3. Auth screens (SignIn, SignUp, OTPVerification, CreateAccount)
4. Account screens (Account, EditParent)
5. Home & Onboarding screens

**Est. Coverage Gain**: ~25-30%

## Testing Strategy

### For Bottom Sheets:
```typescript
// Template structure:
describe('ComponentName', () => {
  const mockRef = React.createRef<any>();
  const mockOnSave = jest.fn();

  describe('Rendering', () => {
    it('should render without crashing');
    it('should render title');
    it('should render items/options');
  });

  describe('Selection', () => {
    it('should call onSave when item selected');
    it('should pass correct data to onSave');
  });

  describe('Ref Methods', () => {
    it('should expose open method');
    it('should expose close method');
  });

  describe('Snapshot', () => {
    it('should match snapshot');
  });
});
```

### For Cards/Components:
```typescript
describe('ComponentName', () => {
  const mockProps = {...};

  describe('Rendering', () => {
    it('should render all required elements');
    it('should handle missing optional props');
  });

  describe('User Interactions', () => {
    it('should call onPress/onClick callbacks');
  });

  describe('Snapshot', () => {
    it('should match snapshot');
  });
});
```

### For Screens:
```typescript
// Use renderWithProviders from testUtils.tsx
describe('ScreenName', () => {
  const mockNavigation = createMockNavigation();
  const mockRoute = createMockRoute();

  describe('Rendering', () => {
    it('should render without crashing');
    it('should display header');
  });

  describe('Navigation', () => {
    it('should navigate to correct screen on action');
  });

  describe('Form/Actions', () => {
    it('should handle form submission');
    it('should validate inputs');
  });
});
```

## Available Test Utilities

Located in `__tests__/utils/testUtils.tsx`:
- `renderWithProviders()` - Renders with Redux & SafeArea
- `createMockNavigation()` - Mock navigation prop
- `createMockRoute()` - Mock route prop
- `createMockAuthUser()` - Mock authenticated user
- `createMockCompanion()` - Mock companion data
- `createMockDocument()` - Mock document data
- `mockTheme` - Complete theme object
- `mockComponents` - Pre-made component mocks

Located in `__tests__/setup/globalMocks.ts`:
- Global mocks for RN modules, navigation, AsyncStorage, etc.

## Daily Progress Targets

To reach 90% in 30 days:
- **Day 1-5**: Bottom sheets → Target: 50% coverage (+8%)
- **Day 6-10**: Cards & components → Target: 56% coverage (+6%)
- **Day 11-15**: Simple screens (auth, account) → Target: 68% coverage (+12%)
- **Day 16-20**: Document screens → Target: 78% coverage (+10%)
- **Day 21-25**: Companion screens → Target: 85% coverage (+7%)
- **Day 26-30**: Edge cases, navigation, cleanup → Target: 90%+ (+5%)

## How to Continue

### Command to run tests with coverage:
```bash
npm run test -- --coverage --coverageReporters=text
```

### Command to test specific file:
```bash
npm run test -- path/to/test/file.test.tsx
```

### Command to update snapshots:
```bash
npm run test -- -u
```

## Files Already at 100% Coverage
- All utils (helpers, validation, constants)
- Auth slice, thunks, selectors
- Companion slice, thunks, selectors
- Theme slice
- Document slice (partial)
- Core components (Button, Input, OTPInput)

## Next Session Start Here:
1. Create test for `GenericSelectBottomSheet.tsx` first (it's used by many others)
2. Then create tests for 5-10 simple bottom sheets using the template
3. Run coverage after each batch to see progress
4. Aim for +2-3% coverage per hour of work

## Important Notes:
- Keep all tests passing - don't commit breaking tests
- Use snapshot tests liberally for quick coverage
- Mock external dependencies properly
- Test user interactions, not implementation details
- Focus on LINE coverage primarily (branches/functions will follow)
