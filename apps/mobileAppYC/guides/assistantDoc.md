# Pet care assistant

The assistant lets a pet owner ask about their animals in plain language, and lets
Siri and the Android launcher run the same actions from outside the app.

It is built so that **every fact it states comes from the owner's own records**. A
platform language model, where one exists, may only choose an action or reword an
answer that is already true. That boundary is the whole design.

---

## The three surfaces

| Surface         | iOS                                                      | Android                                     |
| --------------- | -------------------------------------------------------- | ------------------------------------------- |
| OS assistant    | App Intents (Siri, Spotlight, Shortcuts, Action button)  | App shortcuts (long-press, launcher search) |
| In-app screen   | Account -> Pet care assistant                            | same                                        |
| On-device model | Foundation Models (iOS 26+, Apple Intelligence hardware) | not wired yet - see "Gemini Nano" below     |

All three are driven by one catalogue, `src/features/assistant/actions/catalogue.ts`.
Add a capability there and it becomes available to every surface at once.

---

## How a turn is answered

```
utterance
   |
   v
[1] rule parser          src/features/assistant/nlu/parser.ts
   |                     offline, deterministic, works on every device
   |  low confidence or no match
   v
[2] on-device model      src/features/assistant/services/onDeviceModel.ts
   |                     may ONLY pick an action id from the catalogue
   v
[3] resolver             src/features/assistant/actions/resolvers.ts
   |                     reads Redux state - this is where facts come from
   v
[4] optional rephrase    model rewords an already-true sentence
   |
   v
localised reply
```

Steps 2 and 4 are optional. If the model is missing, slow, or wrong, the answer is
still correct - only its phrasing is plainer. That is why the feature ships on every
supported device rather than only on Apple Intelligence hardware.

### Read actions vs handoff actions

- **Read** actions (`nextAppointment`, `vaccinationStatus`, `upcomingTasks`,
  `petOverview`, `expenseSummary`) answer from local state and are safe for Siri to
  run in the background.
- **Handoff** actions (`addCareTask`, `logExpense`, `bookAppointment`) deliberately
  do **not** commit anything. Booking needs live availability and payment, and a
  medication reminder deserves a human confirming the dose. They open the app at a
  deep link with the slots prefilled.

---

## The offline snapshot

When Siri runs an App Intent, the app's JavaScript is not running. The intent
executes with no Redux store and no session.

So the app keeps a small answer sheet in shared storage:

- written by `services/assistantSnapshot.ts`, debounced by `hooks/useAssistantSync.ts`
- read on iOS by `ios/mobileAppYC/Assistant/AssistantSnapshot.swift`
- read on Android by `android/.../assistant/AssistantSnapshotStore.kt`

It holds pets, upcoming appointments, upcoming tasks and due vaccinations - and
nothing else. **No tokens, no addresses, no clinical notes.** An intent that would
need more than this hands off to the app instead.

It is cleared on sign-out, so a signed-out phone says nothing.

---

## Platform notes

### iOS - App Intents

`ios/mobileAppYC/Assistant/Intents/` holds the intents, the `PetEntity` that lets
Siri disambiguate between animals, and `YosemiteAppShortcuts`, which registers the
zero-setup Siri phrases.

Everything is `@available(iOS 16.0, *)`; the app's deployment target is 15.1.

Intents live in the **app target**, not an extension, so they share
`UserDefaults.standard` with the app. No App Group entitlement is needed, which
keeps provisioning unchanged.

Apple allows at most ten App Shortcuts, so `YosemiteAppShortcuts` registers the five
highest-traffic actions. The rest stay available in the Shortcuts app and Spotlight.

### iOS - Foundation Models

`OnDeviceModelBridge.swift` wraps `SystemLanguageModel`, guarded by
`#if canImport(FoundationModels)` and `@available(iOS 26.0, *)`. Unavailability is
reported as a reason code (`unsupportedOS`, `unsupportedDevice`, `notEnabled`,
`modelNotReady`) which the UI explains to the owner.

### Android - app shortcuts

`AssistantShortcuts.kt` publishes the catalogue as dynamic shortcuts carrying the
same `yc://app/...` deep links the iOS intents use.

**Why not AppFunctions?** AppFunctions is what lets Gemini call an app's actions
directly, and it is the natural Android counterpart to App Intents. It is not wired
up yet because it requires Android 16, its Gemini integration is a private preview
limited to a short device list, and no emulator image can exercise it. Shortcuts
reach every supported device today.

### Android - Gemini Nano

`OnDeviceModelBridgeModule.kt` currently reports the model as unavailable. Reaching
Gemini Nano means adopting ML Kit's GenAI Prompt API, which:

- declares `minSdkVersion 26` while this app ships `minSdk 24`;
- needs AICore, present only on recent flagships (Pixel 8+, Galaxy S24+), so it
  cannot be exercised on CI or any emulator in the build fleet;
- is a beta API with no deprecation policy and a large transitive tree.

That is a deliberate decision to take on separately, not an oversight. The module's
comment records the same reasoning.

---

## Adding a new action

1. Add the entry to `actions/catalogue.ts` (id, kind, i18n keys, slots).
2. Add a resolver in `actions/resolvers.ts` and register it in `RESOLVERS`.
3. Add keywords to `nlu/parser.ts` so the rule parser can route it offline.
4. Add the `assistant.actions.*` and `assistant.replies.*` strings to **both**
   `en/common.json` and `es/common.json`.
5. For a handoff, add its path to `services/handoffNavigation.ts`.
6. For a Siri phrase, add an intent under `ios/mobileAppYC/Assistant/Intents/` and,
   if it earns one of the ten slots, an entry in `YosemiteAppShortcuts`.

The catalogue test asserts structural invariants (handoff actions have deep links,
required slots are a subset of slots, i18n keys are namespaced), so a half-finished
action fails the suite rather than shipping.

---

## Testing

```bash
# the whole feature
pnpm --filter mobileAppYC run test -- --testPathPatterns="features/assistant"

# one module, with coverage
pnpm --filter mobileAppYC run test -- \
  --testPathPatterns="features/assistant/actions/resolvers" \
  --coverage --collectCoverageFrom="src/features/assistant/actions/resolvers.ts"
```

Resolvers and date parsing take `now` from their context rather than reading the
clock, so no test is time-dependent.
