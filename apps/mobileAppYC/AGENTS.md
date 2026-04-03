# Mobile App — Agent Rules

Inherits all root `AGENTS.md` rules. This file adds mobile-specific rules.

**Stack:** React Native 0.81, React 19, TypeScript, Redux Toolkit, React Navigation 7, react-hook-form + Yup, i18next.

---

## Architecture

```
src/
  screens/     ← full-screen views
  components/  ← reusable UI components
  navigation/  ← React Navigation config
  store/       ← Redux Toolkit slices
  services/    ← API calls (axios)
  hooks/       ← custom React hooks
  utils/       ← pure utility functions
  i18n/        ← translation files
```

---

## State Management

**Redux Toolkit** (not Zustand — that's frontend only).

- Redux for shared/persisted state across screens.
- `useState` for ephemeral UI state (modal open, input focus, animation state).
- Redux Persist is active — bump the persist `version` key when changing slice shape.

---

## Navigation

React Navigation 7. Always type your route params:

```ts
type RootStackParamList = {
  Home: undefined;
  Detail: {id: string};
};
```

Never use bare string literals for route names — use the typed `ParamList`.

---

## Internationalisation

All user-visible strings must use `t()` from i18next. Never hardcode English text in components.

```tsx
const {t} = useTranslation();
<Text>{t('screen.title')}</Text>;
```

Add new keys to `src/i18n/` before using them.

## Design System Consistency

- Use **Satoshi** for all user-visible text in mobile (`theme.typography` + component overrides). Do not introduce new Clash/SF text styles.
- For appointment status UI (Home, My Appointments, View Appointment), use a single source of truth for label + color mapping from `features/appointments/utils/appointmentStatus`.
- Keep document category/subcategory values aligned with backend enums and frontend labels. If adding/changing category IDs, update mobile constants and API serialization maps together.

---

## Forms

react-hook-form + Yup for all form screens.

```tsx
const {control, handleSubmit} = useForm({
  resolver: yupResolver(schema),
});
```

---

## Testing

```bash
pnpm --filter mobileAppYC run test -- --testPathPattern="path/to/File.test.tsx"
```

### New code = new tests (mandatory)

Every new file you add must ship tests in the same commit batch. No exceptions.

| New code                                    | Required test                                              |
| ------------------------------------------- | ---------------------------------------------------------- |
| Service function / API call                 | Jest unit: success + all error branches                    |
| Redux slice                                 | Jest: every reducer action, selector, and thunk            |
| Custom hook                                 | `renderHook` covering all return values and state branches |
| Utility function                            | Jest unit with full branch coverage                        |
| Screen component                            | Jest + Testing Library render + key interaction            |
| E2E-critical flow (auth, booking, checkout) | Detox test                                                 |

**Coverage bar for new files: Statements ≥ 90%, Branches ≥ 90%, Functions ≥ 90%.**
Never leave an existing file in a worse coverage state than you found it.

### Mandatory pre-commit checks (run in order, never skip)

```bash
npx tsc --noemit                                    # from apps/mobileAppYC/
pnpm --filter mobileAppYC run lint
pnpm --filter mobileAppYC run test -- --testPathPattern="<YourFile>"
```

- Any code change that alters behavior must include matching test updates in the same batch.
- If your change breaks existing targeted tests, fix or update those tests before handoff.
- Before handoff/checkpoint, run and report: mobile lint + mobile `tsc --noemit` + targeted mobile tests for touched areas.
- Detox for E2E — runs separately from unit tests.
- Guard Reactotron with `__DEV__`.

---

## What NOT to Do

- Never assume permissions are granted — request explicitly via `react-native-permissions`.
- Never hardcode file paths — use `RNFS.DocumentDirectoryPath` and platform constants.
- Never add new state management libraries — Redux Toolkit is the standard here.
- Never navigate with raw strings — use typed `ParamList`.
- Never hardcode user-visible strings — always `t()`.
