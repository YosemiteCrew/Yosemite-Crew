---
id: backend-api-organisationRating
title: Organisationrating API
slug: /apps/backend/api/organisationRating
---

**Endpoints**

### POST /:organisationId
- Auth: `authorizeCognitoMobile`
- Params: `organisationId`
- Controller: `OrganisationRatingController.rateOrganisation`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /:organisationId/is-rated
- Auth: `authorizeCognitoMobile`
- Params: `organisationId`
- Controller: `OrganisationRatingController.isUserRatedOrganisation`
- Response: `400`: keys `message`, `200`: keys `organisation`, `500`: keys `message`
