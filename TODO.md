# Code Quality Improvements TODO

## TaskCard.tsx
- [x] Change isNaN to Number.isNaN on lines 75 (2 instances)

## TaskTypeBottomSheet/helpers.ts
- [x] Change forEach to for...of on line 20
- [x] Optimize multiple push calls on line 23
- [x] Change [length - 1] to .at(-1) on line 39
- [x] Remove useless non-empty check on line 49
- [x] Change forEach to for...of on lines 61, 113, 172
- [x] Change [length - 1] to .at(-1) on line 146

## selectors.ts
- [x] Remove 'unknown' from union type on line 6
- [x] Change isNaN to Number.isNaN on lines 11, 17

## thunks.ts
- [x] Replace deprecated substr with slice on line 41

## types.ts
- [x] Fix union types overridden by string (3 instances around line 245)

## AddTaskScreen/taskBuilder.ts
- [x] Remove unnecessary type assertion on line 113

## EditTaskScreen/taskBuilder.ts
- [x] Remove unnecessary type assertion on line 112

## TaskViewScreen/TaskViewScreen.tsx
- [x] Change isNaN to Number.isNaN on lines 76 (2 instances), 89

## dateHelpers.ts
- [x] Remove commented out code
