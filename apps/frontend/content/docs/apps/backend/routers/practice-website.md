---
id: backend-api-practice-website
title: Practice Website API
slug: /apps/backend/api/practice-website
---

The authenticated editor for a practice's website: read the saved template and copy, and save or publish it. Reading needs `teams:view:any` and saving needs `teams:edit:any`, the same pair as the booking page. Publishing is refused with `409` until the practice's online booking page is live, because every template's booking button opens that page.

## Endpoints

### GET /:organisationId

- Params: `organisationId`
- Controller: `PracticeWebsiteController.getConfig`
- Response: `200`: keys `data` - the template, headline, tagline, about text, publish state and, only while the site is reachable, its `publicUrl`

### PUT /:organisationId

- Params: `organisationId`
- Body fields: `templateId`, `headline`, `tagline`, `about`, `published`
- Controller: `PracticeWebsiteController.saveConfig`
- Response: `200`: keys `data`
