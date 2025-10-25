# Task and Expense Module Duplication Analysis

## Executive Summary
The task and expense modules show substantial code duplication patterns across screens (AddTaskScreen, EditTaskScreen, AddExpenseScreen, EditExpenseScreen), form sections, styling, and card components. The analysis identifies 5 major areas of duplication that could be consolidated without breaking changes.

---

## 1. AddTaskScreen vs EditTaskScreen - Screen Level Duplication

### Current Status: ~80% Similar Structure

**File Comparison:**
- AddTaskScreen: ~456 lines
- EditTaskScreen: ~429 lines

### Common Patterns:

#### A. Form Initialization & Setup
```typescript
// Both screens do:
const { formData, errors, updateField, ... } = useTaskFormState();
const { refs, openSheet, closeSheet } = useFormBottomSheets();
const { taskTypeSheetRef, medicationTypeSheetRef, ... } = useTaskFormSheets();
const { fileToDelete, handleTakePhoto, ... } = useFileOperations({ ... });
```

**Differences:**
- AddTaskScreen: Initializes with DEFAULT form data, uses setSelectedCompanion
- EditTaskScreen: Initializes from task via initializeFormDataFromTask()

#### B. Form Validation Patterns
```typescript
// AddTaskScreen/validation.ts
export { validateTaskForm } from '@/utils/taskValidation';

// EditTaskScreen/validation.ts  
export const validateTaskForm = (formData: TaskFormData): TaskFormErrors => {
  return validateTaskFormUtility(formData, null, {
    requireTaskTypeSelection: false,
    checkBackdates: false,
  });
};
```

**Issue:** Different validation logic wrapped differently

#### C. Form Submission
Both follow same pattern:
1. Validate form
2. Build task from form data
3. Dispatch action (addTask vs updateTask)
4. Navigate back

**Duplication:** ~50 lines of identical logic

#### D. Back Button Handling
```typescript
// Both screens:
const handleBack = () => {
  if (hasUnsavedChanges) {
    discardSheetRef.current?.open();
  } else {
    navigation.goBack();
  }
};
```

#### E. Delete Functionality
Only EditTaskScreen has delete, but uses duplicated patterns:
- Delete bottom sheet setup
- Confirm delete with API call
- Reset navigation

### Potential Consolidation Points:

1. **Extract Common Screen Container**
   - Create `useFormScreenBase()` hook that handles:
     - Form initialization (with configurable initial data)
     - Bottom sheet management
     - File operations
     - Navigation state
   
2. **Create Shared Validation Wrapper**
   - Unified validation logic with options flag
   - Centralized error message formatting

3. **Extract Save/Submit Handler**
   - Generic handler that accepts:
     - Form data
     - Action dispatcher (addTask/updateTask)
     - Success callback
     - Error handler

---

## 2. Form Sections - Component Level Duplication

### ReminderSection Styling Duplication

**Current Status:** Same styles defined in 2 places
- `/screens/tasks/AddTaskScreen/components/ReminderSection.tsx` (local styles)
- `/screens/tasks/styles.ts` (also defines same reminder styles)

```typescript
// In ReminderSection.tsx - createStyles() function:
reminderPillsContainer: { flexDirection: 'row', gap: theme.spacing[2], ... }
reminderPill: { paddingVertical: theme.spacing[2], ... }
reminderPillSelected: { ... }
reminderPillText: { ... }

// Same in styles.ts:
reminderPillsContainer: { flexDirection: 'row', gap: theme.spacing[2], ... }
reminderPill: { paddingVertical: theme.spacing[2], ... }
reminderPillSelected: { ... }
reminderPillText: { ... }
```

**Problem:** Definition duplication + unclear which should be source of truth

### Similar Form Section Patterns

All form sections follow identical pattern:

```typescript
interface FormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  on[Action]Sheet: () => void;
  theme: any;
}

export const Component: React.FC<FormSectionProps> = ({ ... }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <View>...</View>;
};

const createStyles = (theme: any) => StyleSheet.create({ ... });
```

**Duplication Count:** 
- MedicationFormSection
- SimpleTaskFormSection
- ObservationalToolFormSection
- CommonTaskFields
- ReminderSection
- CalendarSyncSection

All 6 sections follow this exact pattern = **100% structural duplication**

### Toggle Section Patterns

```typescript
// CalendarSyncSection
<View style={styles.toggleSection}>
  <Text style={styles.toggleLabel}>Sync with Calendar</Text>
  <Switch value={...} onValueChange={...} />
</View>

// ReminderSection  
<View style={styles.toggleSection}>
  <Text style={styles.toggleLabel}>Reminder</Text>
  <Switch value={...} onValueChange={...} />
</View>
```

**Styles are duplicated:**
```typescript
// Both define:
toggleSection: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing[4],
},
toggleLabel: {
  ...theme.typography.bodyMedium,
  color: theme.colors.secondary,
  fontWeight: '500',
},
```

### Potential Consolidation:

1. **Create Generic ToggleSectionComponent**
   ```typescript
   interface ToggleSectionProps {
     label: string;
     value: boolean;
     onChange: (value: boolean) => void;
     children?: React.ReactNode;
     theme: any;
   }
   export const ToggleSection: React.FC<ToggleSectionProps> = ({ ... });
   ```

2. **Create FormFieldGroup Wrapper**
   - Standardize field group spacing and styling
   - Extract fieldGroup style reuse

3. **Extract Reminder Pills Component**
   - Reusable pill selector component
   - Used by ReminderSection

---

## 3. Task Card vs Expense Card - Card Component Duplication

### Structure Comparison:

Both TaskCard and ExpenseCard:
- Use SwipeableGlassCard (same base)
- Have similar action buttons (Edit/View)
- Support similar swipe actions
- Have nearly identical style patterns

**TaskCard:** ~432 lines
**ExpenseCard:** ~250 lines (uses shared cardStyles)

### Action Button Pattern (99% identical):

```typescript
// Both have:
const ACTION_WIDTH = 65;
const OVERLAP_WIDTH = 12;
const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2;

// Both calculate:
const visibleActionWidth = showEditAction ? TOTAL_ACTION_WIDTH : ACTION_WIDTH;
const totalActionWidth = OVERLAP_WIDTH + visibleActionWidth;

// Both render:
<SwipeableGlassCard
  actionIcon={Images.viewIconSlide}
  actionWidth={hideSwipeActions ? 0 : totalActionWidth}
  actionBackgroundColor="transparent"
  actionOverlap={hideSwipeActions ? 0 : OVERLAP_WIDTH}
  renderActionContent={
    hideSwipeActions
      ? undefined
      : close => (
          <View style={...actionWrapper}>
            {showEditAction && <TouchableOpacity>Edit</TouchableOpacity>}
            <TouchableOpacity>View</TouchableOpacity>
          </View>
        )
  }
/>
```

### Style Duplication:

**TaskCard defines locally:**
- container, card, fallback
- actionContainer, actionWrapper
- actionButton, editActionButton, viewActionButton
- innerContent, infoRow, avatarGroup
- textContent, title, meta

**ExpenseCard imports from cardStyles.ts:**
- Some shared styles via `createCardStyles(theme)`
- But also defines local styles
- Duplicates some patterns

### Key Differences:

| Aspect | TaskCard | ExpenseCard |
|--------|----------|-------------|
| Avatar Display | Yes (companion + assigned user) | No |
| Details Section | Task-specific details | No |
| Right Column | Status badge | Amount + Paid badge |
| Bottom Button | Complete button | Pay button |
| Details Rendering | Task-specific (medication, obs tool) | None |

### Code Reuse Opportunity:

ExpenseCard already started consolidating with `cardStyles.ts` which has:
- `createCardStyles()` - base card styling
- `getActionWrapperStyle()` - action wrapper styling
- `getEditActionButtonStyle()` - button styling
- `getViewActionButtonStyle()` - button styling

**But TaskCard doesn't use these!** TaskCard redefines everything locally.

### Potential Consolidation:

1. **Update TaskCard to use cardStyles.ts**
   - Replace inline style definitions
   - Use helper functions for action buttons

2. **Create BaseCard Pattern**
   - BaseCard already exists with generic implementation
   - Both TaskCard and ExpenseCard could extend/use it more
   - Current BaseCard is overly generic

3. **Extract Common Swipe Action Logic**
   - Create ActionButtonRenderer component
   - Handles edit/view/custom actions

---

## 4. Form Hooks - State Management Patterns

### useTaskFormState vs useExpenseForm

**useTaskFormState:**
```typescript
- Manages: formData, errors, 4 date/time pickers, hasUnsavedChanges
- Methods: updateField, clearError, resetForm, setFormData, setErrors
- Size: 112 lines
- Returns: 16 different state/function properties
```

**useExpenseForm:**
```typescript
- Manages: formData, errors only
- Methods: handleChange, handleErrorClear, validate, setFormData
- Size: 71 lines  
- Returns: 6 properties
- Includes validation logic
```

### Duplication Patterns:

Both handle:
1. Form data state
2. Error state management
3. Field update handler
4. Error clearing
5. Form validation

### Differences:

- useTaskFormState: Complex due to multiple date/time pickers
- useExpenseForm: Simpler, validation baked in
- useTaskFormState: Separate validation in utils
- useExpenseForm: Custom validation in hook

### Potential Consolidation:

1. **Create Generic useFormState Hook**
   ```typescript
   interface UseFormStateConfig {
     initialData: any;
     validators?: Record<string, (value: any) => string | undefined>;
     customPickerFields?: string[];
   }
   ```

2. **Extract Form Validation Utilities**
   - Centralize validation logic
   - Share between task and expense modules

---

## 5. Task Styles vs Expense Styles - Style Pattern Duplication

### Current Style Files:

**Tasks Module:**
- `/screens/tasks/styles.ts` - form styling
- Embedded styles in form sections
- Embedded styles in TaskCard

**Expenses Module:**  
- `/components/expenses/ExpenseForm/ExpenseForm.tsx` - inline styles
- `/components/common/cardStyles.ts` - shared card styles
- `/utils/cardStyles.ts` - duplicate card styles?

### Duplication Issues:

1. **Toggle Section Styling** (duplicated in 3+ places):
   ```typescript
   toggleSection: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     marginBottom: theme.spacing[4],
   }
   ```

2. **Field Group Styling** (duplicated in 5+ places):
   ```typescript
   fieldGroup: {
     marginBottom: theme.spacing[4],
   }
   ```

3. **Icon Styling** (duplicated in many places):
   ```typescript
   dropdownIcon: {
     width: 16,
     height: 16,
     resizeMode: 'contain',
   },
   calendarIcon: {
     width: 18,
     height: 18,
     resizeMode: 'contain',
   }
   ```

4. **Text Area Styling** (duplicated):
   ```typescript
   textArea: {
     minHeight: 100,
     textAlignVertical: 'top',
   }
   ```

### Existing Attempts at Consolidation:

1. `/utils/cardStyles.ts` - Started but incomplete
   - Has base card creation helpers
   - But limited to card-specific styles

2. `/components/common/cardStyles.ts` - More complete
   - Has `createCardStyles()`, `getActionWrapperStyle()`, etc.
   - Shared between ExpenseCard and (partially) BaseCard

3. `/screens/tasks/styles.ts` - Form-specific
   - Creates all task form styles
   - **Not shared with expense forms**

### Potential Consolidation:

1. **Create Unified Style Factory**
   - `createFormStyles(theme)` - common form styles
   - `createCardStyles(theme)` - card-specific
   - `createIconStyles(theme)` - icon dimensions
   - `createTypographyStyles(theme)` - text styles

2. **Centralize Theme-Based Sizing**
   - All spacings use `theme.spacing[4]`
   - All icons use consistent dimensions
   - Create constants for common sizes

---

## 6. Form Sections in EditTaskScreen - Duplication Alert

### Critical Issue:

EditTaskScreen/components folder has files that only contain re-exports:

```typescript
// EditTaskScreen/components/CommonTaskFields.tsx
export { CommonTaskFields } from '@/components/tasks/CommonTaskFields/CommonTaskFields';

// EditTaskScreen/components/MedicationFormSection.tsx
export { MedicationFormSection } from '@/components/tasks/MedicationFormSection/MedicationFormSection';
```

But the index.ts has mixed approach:
```typescript
// Some re-export from local:
export {MedicationFormSection} from './MedicationFormSection';

// Some re-export from AddTaskScreen:
export {ReminderSection} from '../../AddTaskScreen/components/ReminderSection';
```

### The Problem:

There's **no actual duplication** here (wrapper re-exports), but it creates:
1. Confusion about source of truth
2. Unclear import paths for screens
3. Unnecessary folder structure

---

## Summary Table: Duplication Hot Spots

| Category | Files | Duplication % | Priority | Impact |
|----------|-------|---------------|----------|--------|
| Screen Structure | AddTaskScreen + EditTaskScreen | 80% | HIGH | 120+ lines saved per change |
| Form Sections | 6 components | 100% structural | MEDIUM | Better maintenance |
| Styling | 5+ locations | 60-80% | HIGH | Single source of truth |
| Card Components | TaskCard + ExpenseCard | 70% | MEDIUM | Easier updates |
| Form State | useTaskFormState + useExpenseForm | 50% | LOW | Better patterns |
| Validation | Multiple wrappers | 40% | MEDIUM | Centralized logic |

---

## Recommendations (Non-Breaking Consolidation)

### Phase 1: Styles (Lowest Risk)
1. Create `/utils/formStyles.ts` with common style factories
2. Consolidate toggle section, field group, icon styles
3. Update both task and expense forms to import from shared
4. Update TaskCard to use cardStyles.ts helpers

### Phase 2: Form Sections (Medium Risk)
1. Create generic ToggleSection component
2. Extract FormFieldGroup wrapper
3. Create ReusablePillSelector for reminder options
4. Keep existing components, add composition

### Phase 3: Form State (Medium Risk)
1. Create generic useFormState hook
2. Create useFormValidation hook
3. Migrate both modules incrementally
4. Keep old hooks as wrappers for backward compatibility

### Phase 4: Screen Consolidation (Highest Risk)
1. Extract base form screen container
2. Create useFormScreenBase hook
3. Update Add/Edit screens to use it
4. Requires careful testing

---

## Files to Extract

1. `src/utils/formStyles.ts` - Style utilities
2. `src/hooks/useFormState.ts` - Generic form state
3. `src/hooks/useFormValidation.ts` - Validation wrapper
4. `src/components/common/FormFieldGroup.tsx` - Field wrapper
5. `src/components/common/ToggleSection.tsx` - Toggle component
6. `src/components/common/PillSelector.tsx` - Pill selector
7. `src/screens/common/useFormScreenBase.ts` - Screen container hook

---

## Breaking Changes Required: NONE

All consolidations can be done through:
- Adding new shared components/hooks
- Gradual migration of imports
- Existing components become thin wrappers
- No API changes to existing interfaces

