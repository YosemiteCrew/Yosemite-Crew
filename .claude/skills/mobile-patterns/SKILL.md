# Mobile App Patterns — Yosemite Crew

## Description

Use this skill when working on apps/mobileAppYC. Covers React Native architecture, navigation, Redux state management, and mobile-specific conventions.

TRIGGER: any task in apps/mobileAppYC — screens, components, navigation, state, or native integrations.

---

## Architecture

```
apps/mobileAppYC/
  src/
    screens/        ← Full-screen views
    components/     ← Reusable UI components
    navigation/     ← React Navigation config
    store/          ← Redux Toolkit slices
    services/       ← API calls (axios)
    hooks/          ← Custom React hooks
    utils/          ← Pure utility functions
    i18n/           ← Translation files (i18next)
    assets/         ← Images, fonts
```

---

## State Management

**Redux Toolkit** (not Zustand — that's frontend only). Redux Persist is enabled.

```ts
// Define a slice
import { createSlice } from '@reduxjs/toolkit';

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: { ... },
});
```

Never mix Redux and local `useState` for the same piece of data. Local state is for ephemeral UI state (modal open, input focus). Shared/persisted state goes in Redux.

---

## Navigation

**React Navigation 7** with bottom tabs + native stack + drawer.

```ts
// Type your navigation params
type RootStackParamList = {
  Home: undefined;
  AppointmentDetail: { appointmentId: string };
};
```

Never navigate with bare strings — always use typed route names.

---

## Forms

**react-hook-form + Yup** for all forms.

```tsx
const schema = yup.object({ name: yup.string().required() });
const { control, handleSubmit } = useForm({ resolver: yupResolver(schema) });
```

---

## Internationalisation

All user-visible strings must go through **i18next**.

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<Text>{t('appointments.title')}</Text>;
```

Never hardcode English strings in components.

### UI copy normalization

- Never render raw backend enums or role acronyms directly in UI text (example: `PAYMENT_AT_CLINIC`, `VET`).
- Map technical values to user-friendly labels before rendering.
- Avoid `Actor` as a user-facing label; prefer contextual labels (`Lead`, `Support`) or neutral `Updated by`.

---

## Authentication

AWS Amplify Auth is the mobile auth provider. Firebase handles push notifications and supplementary auth flows. Never bypass Amplify for core auth.

---

## Payments

`@stripe/stripe-react-native` — use the SDK's pre-built UI sheets where possible. Never build custom card input from scratch.

---

## Testing

- **Jest 29** + Testing Library for React Native.
- **Detox** for E2E (run separately, not part of standard CI).
- Target tests: `pnpm --filter mobileAppYC run test -- --testPathPattern="path/to/file"`
- Never run the full suite without `--testPathPattern`.

### Coverage Mandate — Non-Negotiable

**Target: ≥ 95% Statements, Branches, Functions, Lines across `apps/mobileAppYC`. Every change must move coverage upward, never downward.**

#### Rules that apply to every task — add, modify, remove

1. **Any file you touch must finish with equal or higher coverage than you found it.** Run the targeted test and confirm before handoff.
2. **Any file you create must hit ≥ 90% Statements, Branches, Functions on first commit.** New code with no tests is a blocker — do not declare the task done.
3. **When you delete code**, delete the corresponding test code too. Dead test scaffolding inflates noise and hides real gaps.
4. **When you modify behaviour** (rename, refactor, add a branch, change a conditional), update every existing test covering the changed path AND add new cases for new branches.
5. **Snapshot tests count but do not substitute** for behavioural assertions. Every logical branch needs at least one assertion that validates the outcome.

#### Test types required — use all of them, not just one

| Layer     | Tool                         | When required                                                                      |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Unit      | Jest                         | Every service, Redux slice, hook, utility, helper                                  |
| Component | React Testing Library for RN | Every screen and reusable component — render + interaction + conditional rendering |
| Snapshot  | Jest `toMatchSnapshot`       | Stable UI layouts — complement behavioural tests, never replace them               |
| E2E       | Detox                        | Auth flows, booking, checkout, payment, any critical user journey                  |

All four layers must grow together. Do not add unit tests while leaving Detox untouched for critical flows, and vice versa.

#### Coverage enforcement workflow

```bash
# After every change, run coverage for the touched file(s):
pnpm --filter mobileAppYC run test -- --testPathPattern="<YourFile>" --coverage --collectCoverageFrom="src/path/to/YourFile.tsx"

# Check — if Statements/Branches/Functions dropped vs what you started with, add tests before declaring done.
```

---

### New code = new tests (mandatory)

**Every new module, screen, service, hook, slice, or utility added to `apps/mobileAppYC` must ship with tests in the same batch. No exceptions.**

| What you add                                | What you must also add                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| Service function / API call                 | Jest unit: success + all error branches                        |
| Redux slice                                 | Jest: every reducer, action creator, selector, and async thunk |
| Custom hook                                 | `renderHook` covering all return values and state branches     |
| Utility function                            | Jest unit with full branch coverage                            |
| Screen component                            | Jest + Testing Library render + key interaction                |
| E2E-critical flow (auth, booking, checkout) | Detox test                                                     |

**Coverage bar for any new file you author: Statements ≥ 90%, Branches ≥ 90%, Functions ≥ 90%.**

Never leave an existing file in a worse coverage state than you found it.

### Mandatory pre-commit checks (run in order, never skip)

```bash
npx tsc --noemit                                    # from apps/mobileAppYC/
pnpm --filter mobileAppYC run lint
pnpm --filter mobileAppYC run test -- --testPathPattern="<YourFile>"
```

---

## Gotchas

- `react-native-permissions` requires explicit permission requests before accessing camera, location, contacts — never assume granted.
- `react-native-fs` paths differ between iOS and Android — use `RNFS.DocumentDirectoryPath` not hardcoded paths.
- Redux Persist can cause stale state after schema changes — bump the persist version key when changing slice shape.
- `@gorhom/bottom-sheet` requires `GestureHandlerRootView` at app root — it's already there, don't remove it.
- Reactotron is dev-only — guard with `__DEV__` checks.
- i18n resource files are in `src/i18n/` — add new keys there before using `t()`.
