# Issue: Availability Cross-Day Time Handling Is Inconsistent (Frontend)

## Summary

Availability behaves inconsistently when a slot crosses midnight (for example, `9:00 PM` to `5:00 AM`).

This affects availability configured during:

- New user onboarding/profile setup
- Settings page: `http://localhost:3000/settings`
- Organization teams availability editor (`http://localhost:3000/organization` -> Teams -> own account)

Backend UTC conversion appears correct at save time, but frontend rendering/interpretation is inconsistent for next-day boundaries.

## Priority

High. Availability is used across multiple modules and must be reliable before rolling out new time pickers.

## Scope Requested

- Primary fix in **frontend web**.
- Verify backend contract and report if backend changes are required.
- Follow production-grade handling for timezone + cross-midnight slots.

## Problem Statement

When the user sets availability with `startTime > endTime` in local day context (cross-midnight pattern, e.g., Monday `21:00` to Tuesday `05:00`), frontend behavior is inconsistent across screens.

Observed issues:

- Calendar/appointment module appears to show changed or unexpected availability.
- Picker logic appears to rely on hardcoded UTC assumptions in some flows.
- Cross-midnight slot boundaries are not represented consistently as “continues into next day”.

## Expected Behavior

1. Cross-midnight slots are treated explicitly as next-day continuation.
2. Display, edit, and fetch logic remain consistent across onboarding, settings, org teams, and appointment calendar.
3. Timezone configured in settings is used consistently for conversion and display.
4. If a user selects Monday `10:00 PM`, slot options and rendering should respect day rollover (Monday late hours + next-day continuation), not collapse into an incorrect same-day interpretation.

## Actual Behavior

- Availability saved from profile/onboarding can appear different in appointment/calendar flows.
- Data shown after `/fhir/v1/availability/:orgId/base/all` call appears mixed or interpreted incorrectly in UI.
  response:

## Reproduction Steps

1. Create/sign in as a new user in an organization.
2. Set availability during onboarding/profile setup.
3. Use a cross-midnight slot (example: `9:00 PM` to `5:00 AM`).
4. Save and verify profile availability response.
5. Open appointment module/calendar.
6. Observe data after the API call below and compare with the saved availability.

## API Evidence

### 1) Profile availability response (example)

```json
[
  {
    "_id": "69c638f3652d6c830b65b929",
    "userId": "c364b892-3021-7006-3c50-bf2ffed3f26d",
    "dayOfWeek": "MONDAY",
    "slots": [
      {
        "startTime": "16:30",
        "endTime": "17:30",
        "isAvailable": true
      }
    ],
    "createdAt": "2026-03-27T07:59:47.780Z",
    "updatedAt": "2026-03-27T07:59:47.780Z"
  },
  {
    "_id": "69c638f3652d6c830b65b92d",
    "userId": "c364b892-3021-7006-3c50-bf2ffed3f26d",
    "dayOfWeek": "SATURDAY",
    "slots": [
      {
        "startTime": "03:30",
        "endTime": "14:15",
        "isAvailable": true
      }
    ],
    "createdAt": "2026-03-27T07:59:47.780Z",
    "updatedAt": "2026-03-27T07:59:47.780Z"
  }
]
```

### 2) Calendar flow API call

- Request URL: `https://devapi.yosemitecrew.com/fhir/v1/availability/6970ca8262012cc3e1c93099/base/all`
- Method: `GET`

Response contains multiple records (org-level defaults + multiple users), including entries for the same user as above. Example excerpt:

```json
{
  "data": [
    {
      "_id": "6970d1772a9f903dd29359a3",
      "userId": "",
      "organisationId": "6970ca8262012cc3e1c93099",
      "dayOfWeek": "MONDAY",
      "slots": [
        {
          "startTime": "09:00",
          "endTime": "17:00",
          "isAvailable": true
        }
      ]
    },
    {
      "_id": "69c638f3652d6c830b65b929",
      "userId": "c364b892-3021-7006-3c50-bf2ffed3f26d",
      "organisationId": "6970ca8262012cc3e1c93099",
      "dayOfWeek": "MONDAY",
      "slots": [
        {
          "startTime": "16:30",
          "endTime": "17:30",
          "isAvailable": true
        }
      ]
    }
  ]
}
```

## Working Hypothesis

- Frontend is likely mixing/merging `base/all` records incorrectly (org defaults + user-specific rows).
- Cross-midnight logic may not be normalized consistently before rendering/editing.
- Timezone conversion rules may differ between availability editor and calendar consumer.

## Requested Implementation Direction

1. Normalize slot model in frontend with explicit cross-day semantics.
2. Apply one conversion strategy for all screens:
   - local timezone input -> backend payload
   - backend payload -> local timezone display
3. In consumers of `base/all`, resolve precedence deterministically:
   - user-specific availability over org defaults (when applicable)
4. Remove hardcoded UTC assumptions from picker/render paths.
5. Add targeted tests for:
   - same-day slots
   - cross-midnight slots
   - timezone offsets
   - merge precedence from `base/all`

## Notes

- If backend contract is insufficient for deterministic cross-day handling, document the required backend changes for the backend engineer.
- Frontend fix should be done first and validated end-to-end in onboarding, settings, org teams, and appointment calendar.
