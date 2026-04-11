---
id: backend-api-expense
title: Expense API
slug: /apps/backend/api/expense
---

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
