# Duplication Analysis - Quick Reference

## Key Findings

### The Numbers
- **Total Duplication:** 800+ lines across task and expense modules
- **Potential Reduction:** 400-600 lines without breaking changes
- **Primary Hotspots:** Screen-level code, styling, form sections

### Duplication by Severity

#### CRITICAL (High Impact, Quick Win)
```
1. Icon Styling (dropdownIcon, calendarIcon)
   - 8 copies of same 3-4 line definition
   - Impact: Extract to 1 utility = 20 lines saved

2. fieldGroup Styling
   - 10 copies of same 2 line definition
   - Impact: Extract to utility = 10 lines saved

3. toggleSection Styling  
   - 3 copies of 6-line definition
   - Impact: Extract to component = 20 lines saved

4. textArea Styling
   - 4 copies of same 3 line definition
   - Impact: Extract to utility = 10 lines saved
```

#### HIGH (Large Impact)
```
1. AddTaskScreen vs EditTaskScreen
   - 300-330 duplicated lines (70-75% of code)
   - Consolidation: Create base form screen container
   - Impact: 150+ lines saved

2. Form Sections (6 components)
   - 100% identical structure across components
   - Consolidation: Create component factory
   - Impact: 150+ lines saved

3. TaskCard vs ExpenseCard
   - 100+ lines of identical action button logic
   - Consolidation: Extract SwipeableCardRenderer
   - Impact: 80+ lines saved
```

#### MEDIUM (Moderate Impact)
```
1. useTaskFormState vs useExpenseForm
   - 50% overlapping logic (100% same pattern)
   - Consolidation: Generic useFormState hook
   - Impact: 40+ lines saved

2. Validation Wrappers
   - Multiple wrapper layers with duplication
   - Consolidation: Unified validation factory
   - Impact: 30+ lines saved
```

---

## 5-Minute Understanding

### What's Being Duplicated?

**Form Layout Pattern (Affects 10+ files):**
```typescript
// Used in 6 form sections + expense form + others
<View style={styles.fieldGroup}>
  <Input/TouchableInput ... />
</View>
```

**Toggle Pattern (Affects 3+ files):**
```typescript
// Used in ReminderSection, CalendarSyncSection, and more
<View style={styles.toggleSection}>
  <Text>{label}</Text>
  <Switch ... />
</View>
```

**Card Action Button Pattern (TaskCard + ExpenseCard):**
```typescript
// 99% identical action button rendering logic
<SwipeableGlassCard renderActionContent={...}>
  {showEditAction && <TouchableOpacity>Edit</TouchableOpacity>}
  <TouchableOpacity>View</TouchableOpacity>
</SwipeableGlassCard>
```

**Form State Management Pattern:**
```typescript
// useTaskFormState and useExpenseForm use identical pattern
const [formData, setFormData] = useState(...);
const [errors, setErrors] = useState(...);
const updateField = (field, value) => { ... };
const clearError = (field) => { ... };
```

---

## Where the Duplication Lives

### Style Files (150+ lines)
- `/screens/tasks/styles.ts` - Defines styles used elsewhere
- ReminderSection.tsx - Redefines same styles
- CalendarSyncSection.tsx - Redefines same styles
- SimpleTaskFormSection.tsx - Redefines same styles
- ExpenseForm.tsx - Redefines form styles
- TaskCard.tsx - Redefines card styles
- BaseCard.tsx - Defines generic card styles (not used by TaskCard)

### Screen Files (350+ lines)
- `AddTaskScreen.tsx` vs `EditTaskScreen.tsx` - 70-75% overlap
- `AddExpenseScreen.tsx` vs `EditExpenseScreen.tsx` - 35-40% overlap (ExpenseForm reduces duplication)

### Form Sections (250+ lines)
- 6 task form section components all use identical wrapper pattern
- All define same style structure

### Form Hooks (50+ lines)
- `useTaskFormState.ts` - 112 lines
- `useExpenseForm.ts` - 71 lines
- 50+ lines of overlapping logic with different naming

---

## Why NOT Using Existing Components?

### BaseCard Problem
- `BaseCard.tsx` exists but is too generic with 15+ optional props
- TaskCard reimplements 90% locally (easier to understand)
- ExpenseCard reimplements 50% locally
- Both would benefit from intermediate abstraction

### Form Section Pattern
- No base component for form sections exists
- All 6 sections have identical structure but different content
- Could use component composition but would need wrapper

### Expense vs Task Forms
- ExpenseForm (single component for add/edit) - better structure
- TaskForm (Add and Edit screens separate) - more duplication
- Different architectural choices created duplication

---

## Consolidation Strategy (Zero Breaking Changes)

### Phase 1: Extract Styles (1-2 hours)
```
Create: /utils/formStyles.ts
├── createIconStyles() - for all icons
├── createFieldGroupStyles()
├── createToggleSectionStyles()
└── createTextAreaStyles()

Update: Every file using these styles to import from utility
Result: 50+ lines saved, no API changes
```

### Phase 2: Create Shared Components (3-4 hours)
```
Create:
├── ToggleSection.tsx - reusable toggle component
├── FormFieldGroup.tsx - wrapper for field spacing
└── PillSelector.tsx - reusable pill selection

Update: Form sections to use new components
Result: 100+ lines saved, better composition
```

### Phase 3: Consolidate Cards (2-3 hours)
```
Update: TaskCard.tsx
├── Use cardStyles.ts for base styles
├── Use createCardStyles() helper
└── Extract renderActionContent

Update: ExpenseCard.tsx
├── Align with TaskCard patterns
└── Share action button logic

Result: 80+ lines saved
```

### Phase 4: Form State (2-3 hours)
```
Create: /hooks/useFormState.ts - generic implementation
├── Support custom validators
├── Support picker fields
└── Support resetForm option

Update: useTaskFormState as wrapper
Update: useExpenseForm as wrapper

Result: 40+ lines saved, better patterns
```

### Phase 5: Screen Consolidation (4-6 hours, requires testing)
```
Create: /hooks/useFormScreenBase.ts
├── Handles initialization
├── Manages bottom sheets
├── Handles file operations
└── Manages navigation

Update: AddTaskScreen + EditTaskScreen to use hook
Result: 200+ lines saved
```

---

## Quick Wins (Do These First)

1. **Extract Icon Styles** (30 min)
   - Save 20 lines
   - Zero dependencies
   - Used by 8+ files

2. **Extract Toggle Section Component** (45 min)
   - Save 30 lines
   - Used by ReminderSection, CalendarSyncSection
   - Simple replacement

3. **Update TaskCard to Use cardStyles.ts** (1 hour)
   - Save 50 lines
   - cardStyles.ts already exists
   - Just import and use

---

## Risk Assessment

| Phase | Effort | Risk | Testing Required |
|-------|--------|------|------------------|
| 1 (Styles) | 1-2h | LOW | Unit tests on styles |
| 2 (Components) | 3-4h | LOW | Component snapshots |
| 3 (Cards) | 2-3h | MEDIUM | Visual tests, swipe behavior |
| 4 (Hooks) | 2-3h | MEDIUM | Hook testing, form behavior |
| 5 (Screens) | 4-6h | HIGH | E2E tests, all workflows |

**Total Effort:** 12-18 hours
**Total Testing:** 3-5 hours
**Total Risk Mitigation:** Can be done phase-by-phase with no breaking changes

---

## Files to Create

1. `/utils/formStyles.ts` (30 lines) - Style utilities
2. `/components/common/ToggleSection.tsx` (40 lines) - Component
3. `/components/common/FormFieldGroup.tsx` (20 lines) - Wrapper
4. `/components/common/PillSelector.tsx` (60 lines) - Component
5. `/hooks/useFormState.ts` (100 lines) - Generic hook
6. `/hooks/useFormScreenBase.ts` (80 lines) - Screen base hook

## Files to Modify

1. Remove: Duplicate style definitions across 20+ files
2. Update: Add imports of shared styles/components
3. Simplify: Form sections to use ToggleSection
4. Simplify: AddTaskScreen + EditTaskScreen to use useFormScreenBase

---

## Expected Results After Consolidation

### Before
- 800+ lines of duplication
- 20+ files with duplicate style definitions
- 6+ form section components with identical structure
- 2 screen files with 70% overlap
- 2 form hooks with 50% overlap

### After
- ~200 lines of duplication (unavoidable due to minor differences)
- 1-2 style utility files
- 3-4 shared form components
- 2 screen files using base container hook
- Generic form state hooks with wrappers

### Benefits
- 400-600 lines removed (30-40% reduction)
- Single source of truth for styles
- Better component composition
- Easier to update styling globally
- Reduced testing surface area
- Better code reusability across modules

