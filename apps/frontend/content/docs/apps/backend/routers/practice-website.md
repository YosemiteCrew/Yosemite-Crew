---
id: backend-api-practice-website
title: Practice Website API
slug: /apps/backend/api/practice-website
---

Lets a practice choose its website template, edit its information, save a draft and publish or unpublish the website. Online booking must be live before publishing so visitors can use the website's booking button.

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
