# Clinical Terms SOAP Frontend Guide

## Objective

Integrate backend clinical-term suggestions into the existing SOAP form experience so vets get inline autocomplete while typing, without replacing free-text SOAP note entry.

## Scope

This guide covers frontend integration only.

Backend support already exists for:

1. importing clinical terms into the backend codebook
2. suggesting clinical terms for autocomplete
3. filtering suggestions by domain and species

## Locked Product Decisions

1. SOAP remains free-text first
2. Autocomplete is assistive, not mandatory
3. Suggestion insertion should happen inline inside the existing textarea flow
4. Existing SOAP save/submit behavior should remain unchanged in the first pass
5. Frontend should use the current form renderer and input system, not a new standalone SOAP editor

## Current Backend Contract

### Endpoint

`GET /v1/codes/terms/suggest`

### Query params

1. `q`: current typed fragment
2. `domain`: one of:
   `ReasonForVisit | PresentingComplaint | DiagnosticTest | Diagnosis | Procedure`
3. `species`: one or more of:
   `SA | LA | FARM | EXOTICS | EQUINE | AVIAN`
4. `limit`: max `50`

### Example requests

```bash
GET /v1/codes/terms/suggest?q=vom&domain=Diagnosis&species=SA&limit=8
GET /v1/codes/terms/suggest?q=abdo&domain=Procedure&species=EQUINE
GET /v1/codes/terms/suggest?q=xray&domain=DiagnosticTest&species=SA
```

### Response shape

```json
{
  "items": [
    {
      "ycCode": "YC-000001",
      "label": "Vomiting",
      "domain": "Diagnosis",
      "species": ["SA"],
      "synonyms": ["Vomiting", "Emesis"],
      "source": "VeNom"
    }
  ]
}
```

## Current Frontend Touchpoints

SOAP textareas are currently rendered through:

1. [TextRenderer.tsx](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextRenderer.tsx)
2. [FormDesc.tsx](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/ui/inputs/FormDesc/FormDesc.tsx)

SOAP form templates currently live in:

1. [forms.ts](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/types/forms.ts)

This is the correct integration point. Do not build a second SOAP UI outside the form engine.

## Recommended Frontend Design

## New component

Create a dedicated wrapper around the existing textarea instead of modifying every form field separately.

Suggested file:

1. `/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/components/TerminologyTextarea.tsx`

Responsibilities:

1. render the existing textarea UI
2. track caret position
3. debounce the active search term
4. call backend suggestions
5. render the dropdown
6. insert the selected suggestion into the current cursor position

## Suggested service

Suggested file:

1. `/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/services/clinicalTermsService.ts`

Suggested API:

```ts
export type ClinicalTermSuggestion = {
  ycCode: string;
  label: string;
  domain?: 'ReasonForVisit' | 'PresentingComplaint' | 'DiagnosticTest' | 'Diagnosis' | 'Procedure';
  species: ('SA' | 'LA' | 'FARM' | 'EXOTICS' | 'EQUINE' | 'AVIAN')[];
  synonyms: string[];
  source?: string;
};

export async function suggestClinicalTerms(params: {
  q: string;
  domain?: string;
  species?: string[];
  limit?: number;
}): Promise<{ items: ClinicalTermSuggestion[] }> {
  // fetch /v1/codes/terms/suggest
}
```

## Form schema metadata

Do not enable autocomplete for every textarea globally.

Add explicit metadata on SOAP fields that should participate in terminology search.

Suggested field metadata shape:

```ts
meta: {
  terminology: {
    enabled: true,
    domain: 'Diagnosis'
  }
}
```

Example fields in [forms.ts](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/types/forms.ts):

```ts
{
  id: 'tentative_diagnosis',
  type: 'textarea',
  label: 'Tentative diagnosis',
  placeholder: 'Enter tentative diagnosis',
  meta: {
    terminology: {
      enabled: true,
      domain: 'Diagnosis'
    }
  }
}
```

Suggested first-pass mapping:

1. `subjective_history` -> `PresentingComplaint`
2. `general_behavior` -> `PresentingComplaint`
3. `musculoskeletal_exam` -> `PresentingComplaint`
4. `neuro` -> `PresentingComplaint`
5. `tentative_diagnosis` -> `Diagnosis`
6. `differential_diagnosis` -> `Diagnosis`
7. `prognosis` -> no autocomplete in first pass
8. `additional_notes` -> `Procedure` only if product wants it, otherwise skip
9. `important_notes` -> no autocomplete in first pass

## Rendering strategy

Update [TextRenderer.tsx](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextRenderer.tsx) to switch on field metadata:

1. if `field.meta?.terminology?.enabled !== true`, keep current `FormDesc`
2. if enabled, render `TerminologyTextarea`

This keeps the blast radius small.

## Suggestion UX rules

### Triggering

1. only search when the active token length is at least `2`
2. debounce requests by `150-250ms`
3. do not search when textarea is read-only
4. close suggestions on blur, escape, or empty token

### Matching token

Use the current word fragment before the caret, not the entire textarea value.

Examples:

1. `"Patient has vom|"` -> query `vom`
2. `"Pain in abd| and fever"` -> query `abd`
3. `"Likely gastritis.\nVom|"` -> query `vom`

This avoids noisy results when the SOAP note becomes large.

### Dropdown behavior

Each item should show:

1. primary label
2. optional domain badge
3. one synonym if it helps disambiguate
4. optional source badge like `VeNom` or `SNOMED`

Keyboard behavior:

1. `ArrowDown` and `ArrowUp` move selection
2. `Enter` inserts selected term
3. `Escape` closes the list
4. `Tab` should keep normal form navigation unless product explicitly wants term acceptance

### Insertion behavior

When a user picks a suggestion:

1. replace the active token before the caret
2. keep the rest of the textarea untouched
3. preserve natural typing flow by adding a trailing space only when appropriate

Example:

1. current text: `Patient has vom`
2. selected term: `Vomiting`
3. result: `Patient has Vomiting `

## Species resolution

Frontend should derive `species` from the selected companion in the current appointment context.

Suggested translation for the first pass:

1. `dog` -> `SA`
2. `cat` -> `SA`
3. `horse` -> `EQUINE`
4. other species:
   skip the filter for now unless backend mapping exists

If the appointment has no companion species context, call the endpoint without `species`.

## Suggested implementation order

1. Create `clinicalTermsService.ts`
2. Create `TerminologyTextarea.tsx`
3. Add `terminology` metadata to targeted SOAP fields in [forms.ts](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/types/forms.ts)
4. Update [TextRenderer.tsx](/Users/harshvardhan/github/Yosemite-Crew/apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextRenderer.tsx) to route enabled fields through the new component
5. Add targeted tests for:
   1. request debouncing
   2. dropdown rendering
   3. keyboard navigation
   4. insertion at caret
   5. no-op behavior for fields without terminology metadata

## Suggested first version

Keep the first version narrow:

1. only SOAP diagnosis-related fields
2. only one suggestion dropdown
3. only inline insertion
4. no highlighted spans inside textarea
5. no saved term references yet

This gets working autocomplete live quickly.

## Future improvements

After the first version is stable, frontend can add:

1. saved selected concept references alongside raw text
2. richer synonym highlighting
3. pinned recent terms per SOAP section
4. clinic-specific custom terms
5. mixed domain searching when product wants one shared suggestion pool

## Example frontend wiring

Minimal decision logic:

```ts
const terminologyConfig = field.meta?.terminology;

if (!terminologyConfig?.enabled) {
  return <FormDesc ... />;
}

return (
  <TerminologyTextarea
    fieldId={field.id}
    label={field.label ?? ''}
    value={value}
    domain={terminologyConfig.domain}
    species={resolvedSpecies}
    onChange={onChange}
    readOnly={readOnly}
  />
);
```

## Testing checklist

1. Suggestion API is not called for short inputs like `v`
2. Suggestion API is called for `vo`
3. `Diagnosis` fields send `domain=Diagnosis`
4. Dog and cat SOAP contexts send `species=SA`
5. Horse SOAP contexts send `species=EQUINE`
6. Selecting a suggestion replaces only the active token
7. Existing non-SOAP textareas behave exactly as before
8. Read-only SOAP views do not show the suggestion dropdown

## Risks

1. Calling the backend on the full textarea value will produce noisy results and unnecessary load
2. Global textarea enhancement will affect unrelated forms
3. Insertion logic must preserve caret and text selection correctly or the UX will feel broken
4. Species inference must be explicit, otherwise the suggestion quality will degrade

## Recommended handoff summary

Frontend should integrate clinical-term autocomplete by extending the existing SOAP textarea renderer, not by introducing a new SOAP experience. The backend contract is already simple enough to support a lightweight, debounced typeahead component.
