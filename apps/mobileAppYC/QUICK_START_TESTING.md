# Quick Start Guide: Increase Test Coverage

## Current Status
- **Coverage**: 42.16% lines
- **Tests**: 602 passing
- **Target**: 90%
- **Need**: +47.84% (~1,820 lines)

## Fastest Way to Increase Coverage

### Step 1: Run This Command First
```bash
cd /Users/harshitwandhare/Desktop/Yosemite-Crew/apps/mobileAppYC
npm run test -- --coverage --coverageReporters=text 2>&1 | grep -E "^\s+[A-Za-z].*\.(tsx|ts)\s+\|" | awk -F'|' '$2+0 < 30' | head -30
```

This shows all files under 30% coverage - your targets!

### Step 2: Copy-Paste Test Template

Create `__tests__/components/common/GenderBottomSheet.test.tsx`:

```typescript
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {GenderBottomSheet} from '@/components/common/GenderBottomSheet/GenderBottomSheet';

// Mock dependencies
jest.mock('@/components/common/BottomSheet/BottomSheet', () => {
  return {
    __esModule: true,
    default: React.forwardRef(({children, title}: any, ref: any) => {
      const {View, Text} = require('react-native');
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return React.createElement(View, {testID: 'bottom-sheet'},
        React.createElement(Text, null, title),
        children
      );
    }),
  };
});

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {primary: '#007AFF', secondary: '#333', background: '#FFF'},
      spacing: {2: 8, 3: 12, 4: 16},
      typography: {bodyMedium: {fontSize: 14}},
      borderRadius: {md: 8},
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {checkIcon: 1},
}));

describe('GenderBottomSheet', () => {
  const mockOnSave = jest.fn();
  const mockRef = React.createRef<any>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const {getByTestID} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(getByTestID('bottom-sheet')).toBeTruthy();
  });

  it('should call onSave when gender selected', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    const maleOption = getByText('Male');
    fireEvent.press(maleOption);
    expect(mockOnSave).toHaveBeenCalledWith('male');
  });

  it('should have open and close methods', () => {
    render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(mockRef.current.open).toBeDefined();
    expect(mockRef.current.close).toBeDefined();
  });

  it('should match snapshot', () => {
    const {toJSON} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
```

### Step 3: Repeat for All Bottom Sheets

Files to test (in order of ease):
1. `GenderBottomSheet.tsx` (14%)
2. `InsuredStatusBottomSheet.tsx` (14%)
3. `NeuteredStatusBottomSheet.tsx` (14%)
4. `OriginBottomSheet.tsx` (14%)
5. `CountryBottomSheet.tsx` (12%)
6. `BreedBottomSheet.tsx` (12%)
7. `CategoryBottomSheet.tsx` (18%)
8. `BloodGroupBottomSheet.tsx` (17%)

**Each file tested = ~0.5-1% coverage increase**

### Step 4: Check Progress
```bash
npm run test -- --coverage --coverageReporters=text 2>&1 | grep "All files"
```

### Step 5: Commit When You Hit Milestones
```bash
git add .
git commit -m "test: increase coverage to 45%"
```

## Common Issues & Solutions

### Issue: "Element type is invalid"
**Solution**: Mock the component's dependencies BEFORE import:
```typescript
jest.mock('@/components/Whatever', () => {...});
// THEN import your component
import {MyComponent} from '@/components/MyComponent';
```

### Issue: "Cannot read property 'map' of undefined"
**Solution**: Component expects data props. Pass mock data:
```typescript
const mockData = [{id: '1', name: 'Test'}];
<Component data={mockData} />
```

### Issue: Tests pass but coverage doesn't increase
**Solution**: You're testing already-covered code. Check the coverage report for UNCOVERED line numbers and test those specific paths.

## Pro Tips

1. **Use snapshots liberally** - They're fast and increase coverage quickly
2. **Test error paths** - Most uncovered code is error handling
3. **One file at a time** - Test, check coverage, commit
4. **Copy-paste and modify** - Don't start from scratch each time
5. **Focus on line coverage** - Branches/functions follow naturally

## Files That Will Give 10%+ Coverage Boost

1. **ProfileImagePicker.tsx** (3.7%) - ~233 uncovered lines
2. **AddressBottomSheet.tsx** (3.15%) - ~261 uncovered lines
3. **CurrencyBottomSheet.tsx** (7.69%) - ~148 uncovered lines
4. **GenericSelectBottomSheet.tsx** (6.97%) - ~137 uncovered lines
5. **DocumentCard.tsx** (11.11%) - ~110 uncovered lines

Test these 5 files = ~890 lines = ~23% coverage increase!

## Daily Target

- **1 hour** = 3-4 bottom sheet tests = +2-3% coverage
- **2 hours** = 1 complex component test = +2-4% coverage
- **Consistent daily** = 50% in 1 week, 75% in 2 weeks, 90% in 1 month

## Next Commands to Run

```bash
# See your target files
npm run test -- --coverage --coverageReporters=text 2>&1 | grep -E "^\s+[A-Za-z].*\.(tsx|ts)\s+\|" | awk -F'|' '$2+0 < 30'

# Test single file
npm run test -- __tests__/path/to/file.test.tsx

# Update snapshots
npm run test -- -u

# Full coverage report
npm run test -- --coverage --coverageReporters=html
open coverage/lcov-report/index.html
```

## Remember

- **Don't overthink** - Simple tests that make assertions are enough
- **Don't aim for perfect** - 90% coverage with good tests > 100% with bad tests
- **Don't test implementation** - Test behavior and outputs
- **DO commit often** - Every 2-3% increase

Good luck! Start with `GenderBottomSheet` - it's the easiest. 🚀
