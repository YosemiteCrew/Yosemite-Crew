# UI Component Inventory & Taxonomy

**Last updated:** 2026-03-31
**Maintainer:** Frontend platform workstream

This document maps every component under `src/app/ui/` to a taxonomy category,
a status label, and notes on what still needs work.

**Story coverage snapshot (2026-03-31):** `31 / 104` components currently have stories.
Missing stories by area: cards `7`, inputs `4`, layout `14`, overlays `7`, primitives `5`, tables `13`, widgets `28`.

---

## Taxonomy categories

| Category                    | Description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Tokens**                  | Design variables, not components. CSS custom properties and Tailwind theme        |
| **Primitives**              | Lowest-level building blocks: Button, Text, Stack, Badge, Input, icons, Accordion |
| **Inputs**                  | Form control components: Datepicker, Dropdown, Search, FileInput, etc.            |
| **Overlays**                | Modal, Toast, Loader — components that render above page content                  |
| **Layout / Navigation**     | Page shells, headers, sidebars, routing guards                                    |
| **Cards**                   | Card-shaped display units                                                         |
| **Tables**                  | Data table components                                                             |
| **Widgets**                 | Higher-level domain composites that are shared across features                    |
| **Feature-only composites** | Components that live under `features/` and are not meant to be reused             |
| **Legacy / Deprecated**     | Components pending replacement or removal                                         |

---

## Status labels

| Label           | Meaning                                                |
| --------------- | ------------------------------------------------------ |
| ✅ Approved     | Allowed for new development                            |
| 🔄 In migration | Allowed with caution; replacement work in progress     |
| ⚠️ Legacy       | Existing use allowed; new use blocked until remediated |
| ❌ Deprecated   | Replacement required; removal planned                  |

**Approval criteria:** A component is only `Approved` when it has:
token alignment · stable API · tests · story coverage · a11y review · usage docs

---

## Primitives

| Component            | File                                               | Status          | Notes                                                   |
| -------------------- | -------------------------------------------------- | --------------- | ------------------------------------------------------- |
| Button               | `Button.tsx`                                       | ✅ Approved     | Semantic button/link split fixed. Stories added.        |
| Text                 | `Text.tsx`                                         | ✅ Approved     | 14 typography variants via `variant` prop               |
| Stack                | `Stack.tsx`                                        | ✅ Approved     | Flex layout helper                                      |
| Badge                | `Badge.tsx`                                        | ✅ Approved     | Status chip / label                                     |
| Input                | `Input.tsx`                                        | ✅ Approved     | Base input with token borders and error state           |
| Card                 | `Card.tsx`                                         | ✅ Approved     | 3 variants: default / bordered / subtle                 |
| Accordion            | `primitives/Accordion/Accordion.tsx`               | ✅ Approved     | Semantic buttons for expand/edit/delete. Stories added. |
| EditableAccordion    | `primitives/Accordion/EditableAccordion.tsx`       | 🔄 In migration | Wraps Accordion — audit once Accordion is stable        |
| AccordionButton      | `primitives/Accordion/AccordionButton.tsx`         | ⚠️ Legacy       | Review vs Accordion primitive                           |
| SmallAccordionButton | `primitives/Accordion/SmallAccordionButton.tsx`    | ⚠️ Legacy       | Potentially redundant                                   |
| Primary (button)     | `primitives/Buttons/Primary.tsx`                   | ✅ Approved     | Internal — use Button wrapper                           |
| Secondary (button)   | `primitives/Buttons/Secondary.tsx`                 | ✅ Approved     | Internal — use Button wrapper                           |
| Delete (button)      | `primitives/Buttons/Delete.tsx`                    | ✅ Approved     | Internal — use Button wrapper                           |
| BoardScopeToggle     | `primitives/BoardScopeToggle/BoardScopeToggle.tsx` | 🔄 In migration | Story added. Review API and ownership scope.            |
| Close icon           | `primitives/Icons/Close.tsx`                       | ✅ Approved     |                                                         |
| Back icon            | `primitives/Icons/Back.tsx`                        | ✅ Approved     |                                                         |
| Next icon            | `primitives/Icons/Next.tsx`                        | ✅ Approved     |                                                         |
| GlassTooltip         | `primitives/GlassTooltip/`                         | 🔄 In migration | Story added. Audit API and a11y                         |

---

## Inputs

| Component            | File                                                   | Status          | Notes                                                             |
| -------------------- | ------------------------------------------------------ | --------------- | ----------------------------------------------------------------- |
| Search               | `inputs/Search/index.tsx`                              | 🔄 In migration | Story added                                                       |
| Datepicker           | `inputs/Datepicker/index.tsx`                          | 🔄 In migration | Needs story + a11y audit                                          |
| Dropdown             | `inputs/Dropdown/Dropdown.tsx`                         | 🔄 In migration | Story added                                                       |
| LabelDropdown        | `inputs/Dropdown/LabelDropdown.tsx`                    | 🔄 In migration | Story added                                                       |
| MultiSelectDropdown  | `inputs/MultiSelectDropdown/index.tsx`                 | 🔄 In migration | Story added                                                       |
| SearchDropdown       | `inputs/SearchDropdown/index.tsx`                      | 🔄 In migration | Needs story                                                       |
| FileInput            | `inputs/FileInput/FileInput.tsx`                       | 🔄 In migration | Story added. `react-bootstrap` dependency still pending migration |
| FormDesc             | `inputs/FormDesc/FormDesc.tsx`                         | 🔄 In migration | Audit                                                             |
| Slotpicker           | `inputs/Slotpicker/index.tsx`                          | 🔄 In migration | Needs story                                                       |
| ServiceSearch        | `inputs/ServiceSearch/ServiceSearch.tsx`               | ⚠️ Legacy       | Domain-specific — evaluate promotion vs feature-only              |
| SpecialitySearch     | `inputs/SpecialitySearch/SpecialitySearch.tsx`         | ⚠️ Legacy       | Domain-specific                                                   |
| GoogleSearchDropDown | `inputs/GoogleSearchDropDown/GoogleSearchDropDown.tsx` | ⚠️ Legacy       | Google Maps dependency; feature-only candidate                    |

---

## Overlays

| Component               | File                                         | Status          | Notes                                                          |
| ----------------------- | -------------------------------------------- | --------------- | -------------------------------------------------------------- |
| ModalBase               | `overlays/Modal/ModalBase.tsx`               | ✅ Approved     | Focus trap + escape key + role=dialog added. Stories added.    |
| CenterModal             | `overlays/Modal/CenterModal.tsx`             | ✅ Approved     | Layout wrapper for ModalBase                                   |
| ModalHeader             | `overlays/Modal/ModalHeader.tsx`             | ✅ Approved     | Standard modal header with close button                        |
| DeleteConfirmationModal | `overlays/Modal/DeleteConfirmationModal.tsx` | ✅ Approved     | Destructive confirm dialog                                     |
| ChangeStatusModal       | `overlays/Modal/ChangeStatusModal.tsx`       | 🔄 In migration | Needs story                                                    |
| VideoPlayerModal        | `overlays/Modal/VideoPlayerModal.tsx`        | 🔄 In migration | Needs story + iframe a11y audit                                |
| OtpModal                | `overlays/OtpModal/OtpModal.tsx`             | ⚠️ Legacy       | react-bootstrap dependency — migrate                           |
| Toast (overlay)         | `overlays/Toast/Toast.tsx`                   | ⚠️ Legacy       | react-bootstrap dependency — migrate to react-toastify wrapper |
| YosemiteLoader          | `overlays/Loader/YosemiteLoader.tsx`         | 🔄 In migration | Story added                                                    |
| SigningOverlay          | `overlays/SigningOverlay.tsx`                | ⚠️ Legacy       | Feature-heavy — evaluate as feature-only composite             |
| PdfPreviewOverlay       | `overlays/PdfPreviewOverlay.tsx`             | ⚠️ Legacy       | iframe / a11y audit needed                                     |
| Fallback                | `overlays/Fallback/index.tsx`                | 🔄 In migration | Needs story                                                    |

---

## Layout / Navigation

| Component           | File                                                | Status          | Notes                   |
| ------------------- | --------------------------------------------------- | --------------- | ----------------------- |
| Header              | `layout/Header/Header.tsx`                          | 🔄 In migration | Needs story             |
| GuestHeader         | `layout/Header/GuestHeader/GuestHeader.tsx`         | 🔄 In migration | Needs story             |
| HamburgerMenuButton | `layout/Header/HamburgerMenuButton.tsx`             | 🔄 In migration |                         |
| PublicShell         | `layout/PublicShell/index.tsx`                      | 🔄 In migration |                         |
| ToastProvider       | `layout/ToastProvider.tsx`                          | ✅ Approved     | react-toastify provider |
| RouteLoaderOverlay  | `layout/RouteLoaderOverlay.tsx`                     | ✅ Approved     |                         |
| UniversalSearch     | `layout/UniversalSearch/UniversalSearchPalette.tsx` | 🔄 In migration | Needs story             |
| ProtectedRoute      | `layout/guards/ProtectedRoute.tsx`                  | ✅ Approved     |                         |
| PermissionGate      | `layout/guards/PermissionGate.tsx`                  | ✅ Approved     |                         |
| DevRouteGuard       | `layout/guards/DevRouteGuard/DevRouteGuard.tsx`     | ✅ Approved     |                         |

---

## Cards

| Component             | File                                      | Status          | Notes       |
| --------------------- | ----------------------------------------- | --------------- | ----------- |
| Card (base)           | `Card.tsx`                                | ✅ Approved     | 3 variants  |
| CardHeader            | `cards/CardHeader/CardHeader.tsx`         | 🔄 In migration | Needs story |
| ExploreCard           | `cards/ExploreCard/ExploreCard.tsx`       | 🔄 In migration |             |
| AvailabilityCard      | `cards/AvailabilityCard/index.tsx`        | 🔄 In migration |             |
| DocumentsCard         | `cards/DocumentsCard/index.tsx`           | 🔄 In migration |             |
| InventoryCard         | `cards/InventoryCard/index.tsx`           | 🔄 In migration |             |
| InventoryTurnoverCard | `cards/InventoryTurnoverCard/index.tsx`   | 🔄 In migration |             |
| InviteCard            | `cards/InviteCard/InviteCard.tsx`         | 🔄 In migration |             |
| OrgCard               | `cards/OrgCard/OrgCard.tsx`               | 🔄 In migration |             |
| RoomCard              | `cards/RoomCard/index.tsx`                | 🔄 In migration |             |
| SpecialityCard        | `cards/SpecialityCard/SpecialityCard.tsx` | 🔄 In migration |             |
| SpecialitiesCard      | `cards/SpecialitiesCard/index.tsx`        | 🔄 In migration |             |
| TaskCard              | `cards/TaskCard/index.tsx`                | 🔄 In migration |             |
| InvoiceCard           | `cards/InvoiceCard/index.tsx`             | 🔄 In migration |             |

---

## Tables

| Component              | File                                   | Status          | Notes                              |
| ---------------------- | -------------------------------------- | --------------- | ---------------------------------- |
| GenericTable           | `tables/GenericTable/GenericTable.tsx` | 🔄 In migration | Base table primitive. Story added  |
| AvailabilityTable      | `tables/AvailabilityTable.tsx`         | ⚠️ Legacy       | Domain-specific                    |
| DocumentsTable         | `tables/DocumentsTable.tsx`            | ⚠️ Legacy       | Domain-specific                    |
| InventoryTable         | `tables/InventoryTable.tsx`            | ⚠️ Legacy       | Domain-specific                    |
| InventoryTurnoverTable | `tables/InventoryTurnoverTable.tsx`    | ⚠️ Legacy       | Domain-specific                    |
| InvoiceTable           | `tables/InvoiceTable.tsx`              | ⚠️ Legacy       | Domain-specific                    |
| OrganizationList       | `tables/OrganizationList.tsx`          | ⚠️ Legacy       | Domain-specific                    |
| OrgInvites             | `tables/OrgInvites.tsx`                | ⚠️ Legacy       | Domain-specific                    |
| RoomTable              | `tables/RoomTable.tsx`                 | ⚠️ Legacy       | Domain-specific                    |
| SpecialitiesTable      | `tables/SpecialitiesTable.tsx`         | ⚠️ Legacy       | Domain-specific                    |
| common                 | `tables/common.tsx`                    | 🔄 In migration | Shared table cell helpers — review |

---

## Widgets

| Component              | File                                                   | Status          | Notes                                               |
| ---------------------- | ------------------------------------------------------ | --------------- | --------------------------------------------------- |
| DynamicSelect          | `widgets/DynamicSelect/DynamicSelect.tsx`              | ⚠️ Legacy       | react-bootstrap dependency — migrate                |
| UploadImage            | `widgets/UploadImage/UploadImage.tsx`                  | ⚠️ Legacy       | react-bootstrap dependency — migrate                |
| Faq                    | `widgets/Faq/Faq.tsx`                                  | 🔄 In migration | Uses Accordion — should migrate to shared Accordion |
| LaunchGrowTab          | `widgets/LaunchGrowTab/LaunchGrowTab.tsx`              | 🔄 In migration | Grotesk CSS cleaned                                 |
| Summary / Availability | `widgets/Summary/Availability.tsx`                     | 🔄 In migration |                                                     |
| DashboardProfile       | `widgets/DashboardProfile/DashboardProfile.tsx`        | 🔄 In migration |                                                     |
| DashboardSteps         | `widgets/DashboardSteps/index.tsx`                     | 🔄 In migration |                                                     |
| Stats / Revenue        | `widgets/Stats/RevenueLeadersStat.tsx`                 | 🔄 In migration |                                                     |
| Stats / Inventory      | `widgets/Stats/IndividualProductTurnoverStat.tsx`      | 🔄 In migration |                                                     |
| Stats / Annual         | `widgets/Stats/AnnualInventoryTurnoverStat.tsx`        | 🔄 In migration |                                                     |
| Toast variants         | `widgets/Toast/{ErrorToast,Info,Success,Warning}.tsx`  | 🔄 In migration | Needs story                                         |
| Animations             | `widgets/Animations/{BlurIn,TextFade,WordsPullUp}.tsx` | ✅ Approved     | Animation utilities                                 |
| Upgrade                | `widgets/Upgrade/index.tsx`                            | 🔄 In migration |                                                     |
| LabResultValue         | `widgets/LabResultValue/index.tsx`                     | 🔄 In migration |                                                     |
| Cookies                | `widgets/Cookies/Cookies.tsx`                          | 🔄 In migration |                                                     |
| Github                 | `widgets/Github/Github.tsx`                            | 🔄 In migration |                                                     |

---

## Filters

| Component                | File                                         | Status          | Notes           |
| ------------------------ | -------------------------------------------- | --------------- | --------------- |
| Filters                  | `filters/Filters/index.tsx`                  | 🔄 In migration | Needs story     |
| InventoryFilters         | `filters/InventoryFilters/index.tsx`         | ⚠️ Legacy       | Domain-specific |
| InventoryTurnoverFilters | `filters/InventoryTurnoverFilters/index.tsx` | ⚠️ Legacy       | Domain-specific |

---

## react-bootstrap remaining consumers

These files still import `react-bootstrap` and are blocking full Bootstrap removal:

| File                                      | Component     | Migration target                |
| ----------------------------------------- | ------------- | ------------------------------- |
| `overlays/OtpModal/OtpModal.tsx`          | OtpModal      | Custom modal using ModalBase    |
| `overlays/Toast/Toast.tsx`                | Toast overlay | react-toastify                  |
| `widgets/UploadImage/UploadImage.tsx`     | UploadImage   | Custom component                |
| `widgets/DynamicSelect/DynamicSelect.tsx` | DynamicSelect | Custom dropdown                 |
| `inputs/FileInput/FileInput.tsx`          | FileInput     | Custom component                |
| `features/auth/SignIn.tsx`                | Auth form     | Custom form                     |
| `features/auth/SignUp.tsx`                | Auth form     | Custom form                     |
| `features/auth/ForgotPassword.tsx`        | Auth form     | Custom form                     |
| `features/marketing/LandingPage.tsx`      | Carousel      | react-slick (already installed) |

Bootstrap CSS global import in `layout.tsx` must remain until **all** above are migrated.

---

## New component creation rule

Create a new shared component **only if**:

1. No approved existing component fits the use case.
2. The pattern will be reused in at least 2 features.
3. It ships with stories **and** tests in the same batch.

Otherwise: keep as feature-only composite and document it here under "Feature-only composites".
