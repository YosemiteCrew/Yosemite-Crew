---
id: backend-api-pet-passport
title: Pet Passport API
slug: /apps/backend/api/pet-passport
---

Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/companion/:patientId/immunizations

- Auth: `requireWebAuth`
- Permission: `vaccinations:edit:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/treatments

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/titrations

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/clinical-exams

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/sign

- Auth: `requireWebAuth`
- Permission: `passport:attest:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/attest

- Auth: `requireWebAuth`
- Permission: `passport:attest:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/revoke

- Auth: `requireWebAuth`
- Permission: `passport:attest:any`
- Controller: `PetPassportController`

### POST /pms/organisation/:organisationId/companion/:patientId/consents

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PassportConsentController`

### GET /pms/organisation/:organisationId/consents

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PassportConsentController`

### GET /mobile/companion/:patientId

- Auth: `requireMobileAuth`
- Controller: `PetPassportController`

### GET /mobile/companion/:patientId/wallet/apple

- Auth: `requireMobileAuth`
- Controller: `PetPassportController`

### GET /mobile/companion/:patientId/wallet/google

- Auth: `requireMobileAuth`
- Controller: `PetPassportController`

### DELETE /mobile/companion/:patientId/share-link

- Auth: `requireMobileAuth`
- Controller: `PetPassportController`

### POST /mobile/organisation/:organisationId/consents/:consentId/grant

- Auth: `requireMobileAuth`
- Controller: `PassportConsentController`

### POST /pms/organisation/:organisationId/consents/:consentId/revoke

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PassportConsentController`

### POST /pms/organisation/:organisationId/companion/:patientId/issue

- Auth: `requireWebAuth`
- Permission: `passport:edit:any`
- Controller: `PetPassportController`

### GET /pms/organisation/:organisationId/companion/:patientId/passport

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PetPassportController`

### GET /pms/organisation/:organisationId/companion/:patientId/wallet/apple

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PetPassportController`

### GET /pms/organisation/:organisationId/companion/:patientId/wallet/google

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PetPassportController`
