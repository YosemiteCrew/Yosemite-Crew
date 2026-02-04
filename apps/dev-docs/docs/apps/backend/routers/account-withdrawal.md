---
id: backend-api-account-withdrawal
title: Account Withdrawal API
slug: /apps/backend/api/account-withdrawal
---

**Endpoints**

### POST /withdraw
- Auth: `authorizeCognitoMobile`
- Body: `AccountWithdrawalBody`
- Body fields: `fullName`, `email`, `address`, `signatureText`, `message`, `checkboxConfirmed`
- Controller: `AccountWithdrawalController.create`
- Response: `201`: keys `id`, `message`, `500`: keys `message`
