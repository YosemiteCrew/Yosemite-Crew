# UI

Reusable UI primitives and shared components live here.

Examples:

- Button, Input, Card, Badge
- Typography and layout helpers (Text, Stack)

Available now:

- Button (wrapper over Primary/Secondary/Delete)
- Text (typography variants via utility classes)
- Stack (flex layout helper)
- Card (surface wrapper)
- Badge (status/label chip)
- Input (base input with token-based borders)
- Inputs (Datepicker, Dropdowns, Search, FileInput, etc.)
- Filters (Forms, Inventory, general filters)
- Cards (Appointment, Inventory, Forms, etc.)
- Tables (DataTable variants)
- Overlays (Modal, Toast, Loader, etc.)
- Layout (Header, Sidebar, guards)
- Primitives (Buttons, Icons)

Prefer importing from `src/app/ui` for shared UI.

Token source of truth: `src/app/globals.css` (`@theme`). Token reference: [`tokens.md`](./tokens.md).
For the full component list with taxonomy, status labels, and remaining migration work, see [`INVENTORY.md`](./INVENTORY.md).
