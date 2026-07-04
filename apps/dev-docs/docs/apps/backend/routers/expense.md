---
id: backend-api-expense
title: Expense API
slug: /apps/backend/api/expense
---

Lets a pet parent track expenses recorded against a companion (pet), including per-companion listing and summaries. Called by the mobile app; all routes are guarded by the mobile auth middleware (`authorizeCognitoMobile`).

**Endpoints**

### POST /

- Auth: `authorizeCognitoMobile`
- Controller: `ExpenseController.updateExpense`
- Response: `200`: keys `message`, `500`: keys `message`

### DELETE /:expenseId

- Auth: `authorizeCognitoMobile`
- Params: `expenseId`
- Controller: `ExpenseController.deleteExpense`
- Response: `204`: keys `message`, `500`: keys `message`

### GET /:expenseId

- Auth: `authorizeCognitoMobile`
- Params: `expenseId`
- Controller: `ExpenseController.getExpenseById`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /companion/:companionId/list

- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `ExpenseController.getExpensesByCompanion`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /companion/:companionId/summary

- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `ExpenseController.getExpenseSummary`
- Response: `200`: keys `message`, `500`: keys `message`
