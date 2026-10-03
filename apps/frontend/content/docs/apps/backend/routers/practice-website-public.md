---
id: backend-api-practice-website-public
title: Practice Website Public API
slug: /apps/backend/api/practice-website-public
---

The unauthenticated read behind a practice's published website at `/site/<slug>`. No session is required. It shares the public booking page's read budget of 60 requests per 15 minutes per IP, and answers `404` unless the site is published and the practice's booking page is live.

## Endpoints

### GET /:slug

- Params: `slug`
- Controller: `PublicSiteController.getSite`
- Response: `200`: keys `data` - the site's template and copy with the practice's public profile, or `{ redirectTo: <newSlug> }` when the requested slug has been retired
