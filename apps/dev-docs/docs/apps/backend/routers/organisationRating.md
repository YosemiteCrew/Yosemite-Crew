---
id: backend-api-organisationRating
title: Organisationrating API
slug: /apps/backend/api/organisationRating
---

Lets a pet parent rate an organisation and check whether they have already rated it. Both routes are called by the mobile app and authenticated with the mobile Cognito user pool.

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
