---
id: backend-api-pet-passport
title: Pet Passport API
slug: /apps/backend/api/pet-passport
---

Assembles and issues a pet's travel/medical passport for the PIMS (Practice Information Management System, the clinic-facing web app) and the pet-parent mobile app: recording the underlying clinical artifacts (immunizations, parasite treatments, rabies titrations, clinical exams), signing or revoking them, issuing the passport itself, generating Apple/Google Wallet passes, and managing cross-practice sharing consent. Staff `/pms` routes are organisation-RBAC-gated; pet-parent `/mobile` routes carry no organisation in the path and are instead gated by `requireCompanionPermission`, which checks the authenticated parent's own relationship to the companion. The consent endpoints are served by a separate `PassportConsentController`.

**Endpoints**

### POST /pms/organisation/:organisationId/companion/:patientId/immunizations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `encounterId`, `vaccineType`, `vaccineName`, `manufacturer?`, `batchNumber?`, `lotNumber?`, `dateAdministered`, `validFrom?`, `validUntil?`, `nextDueDate?`, `administeringVetName?`, `vetLicenseNumber?`, `site?`, `route?`, `notes?`
- Controller: `PetPassportController.recordImmunization`
- Response: `201`: JSON

### POST /pms/organisation/:organisationId/companion/:patientId/treatments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `encounterId`, `treatmentType`, `productName`, `manufacturer?`, `treatedAt`, `administeringVetName?`, `notes?`
- Controller: `PetPassportController.recordParasiteTreatment`
- Response: `201`: JSON

### POST /pms/organisation/:organisationId/companion/:patientId/titrations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `encounterId`, `approvedLab`, `sampleDate`, `resultIuMl`, `reportUrl?`
- Controller: `PetPassportController.recordRabiesTitration`
- Response: `201`: JSON

### POST /pms/organisation/:organisationId/companion/:patientId/clinical-exams

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `encounterId`, `examinedAt`, `fitForTravel`, `findings?`, `weightKg?`, `temperatureC?`
- Controller: `PetPassportController.recordClinicalExam`
- Response: `201`: JSON

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/sign

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`, `recordId`
- Body fields: `signatoryName?`, `signatoryLicence?` (an absent body is treated as empty)
- Controller: `PetPassportController.signRecord`
- Response: `202`: JSON

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/attest

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`, `recordId`
- Body fields: `signatoryName?`, `signatoryLicence?` (an absent body is treated as empty)
- Controller: `PetPassportController.attestRecord`

### POST /pms/organisation/:organisationId/companion/:patientId/records/:recordId/revoke

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`, `recordId`
- Body fields: `reason?` (an absent body is treated as empty)
- Controller: `PetPassportController.revokeRecord`

### POST /pms/organisation/:organisationId/companion/:patientId/consents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `recipientOrganisationId`, `purpose?`
- Controller: `PassportConsentController.requestConsent`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/consents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `PassportConsentController.listConsents`

### GET /mobile/companion/:patientId

- Auth: `requireMobileAuth`
- RBAC: `requireCompanionPermission`
- Params: `patientId`
- Controller: `PetPassportController.getPassportForParent`

### GET /mobile/companion/:patientId/wallet/apple

- Auth: `requireMobileAuth`
- RBAC: `requireCompanionPermission`
- Params: `patientId`
- Controller: `PetPassportController.getApplePassForParent`
- Response: `200`: binary `.pkpass` file (`Content-Type: application/vnd.apple.pkpass`)

### GET /mobile/companion/:patientId/wallet/google

- Auth: `requireMobileAuth`
- RBAC: `requireCompanionPermission`
- Params: `patientId`
- Controller: `PetPassportController.getGooglePassForParent`
- Response: `200`: keys `saveUrl`

### DELETE /mobile/companion/:patientId/share-link

- Auth: `requireMobileAuth`
- RBAC: `requireCompanionPermission`
- Params: `patientId`
- Controller: `PetPassportController.revokePublicToken`

### POST /mobile/organisation/:organisationId/consents/:consentId/grant

- Auth: `requireMobileAuth`
- Params: `organisationId`, `consentId`
- Body fields: `method`
- Controller: `PassportConsentController.grantConsent`

### POST /pms/organisation/:organisationId/consents/:consentId/revoke

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `consentId`
- Body fields: `reason?`
- Controller: `PassportConsentController.revokeConsent`

### POST /pms/organisation/:organisationId/companion/:patientId/issue

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `passportNumber`, `issuingCountry?`, `issuingAuthority?`, `issuingVetName?`, `issuingVetLicense?`
- Controller: `PetPassportController.issuePassport`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/companion/:patientId/passport

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Controller: `PetPassportController.getPassport`

### GET /pms/organisation/:organisationId/companion/:patientId/wallet/apple

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Controller: `PetPassportController.getApplePass`
- Response: `200`: binary `.pkpass` file (`Content-Type: application/vnd.apple.pkpass`)

### GET /pms/organisation/:organisationId/companion/:patientId/wallet/google

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Controller: `PetPassportController.getGooglePass`
- Response: `200`: keys `saveUrl`
