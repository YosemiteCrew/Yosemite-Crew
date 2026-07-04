---
id: backend-api-account-withdrawal
title: Account Withdrawal API
slug: /apps/backend/api/account-withdrawal
---

Handles account withdrawal (deletion) requests submitted by pet parents from the mobile app. The single endpoint records a signed withdrawal request; it is guarded by the mobile auth middleware (`authorizeCognitoMobile`).

**Endpoints**

### POST /withdraw

- Auth: `authorizeCognitoMobile`
- Body: `AccountWithdrawalBody`
- Body fields: `fullName`, `email`, `address`, `signatureText`, `message`, `checkboxConfirmed`
- Controller: `AccountWithdrawalController.create`
- Response: `201`: keys `id`, `message`, `500`: keys `message`
