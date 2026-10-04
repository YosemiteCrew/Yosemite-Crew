---
id: backend-api-practice-website-public
title: Practice Website Public API
slug: /apps/backend/api/practice-website-public
---

Displays a practice's published website at `/site/<slug>`, including its chosen template, information and booking link. The website is available while it is published and the practice's online booking page is live.

## Endpoints

### GET /:slug

- Params: `slug`
- Controller: `PublicSiteController.getSite`
- Response: `200`: keys `data` - the site's template and copy with the practice's public profile, or `{ redirectTo: <newSlug> }` when the requested slug has been retired
