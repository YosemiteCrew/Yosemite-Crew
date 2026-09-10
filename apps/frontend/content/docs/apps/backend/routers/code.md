---
id: backend-api-code
title: Code API
slug: /apps/backend/api/code
---

Mobile routes are called by the mobile app on behalf of a pet parent.

**Endpoints**

### GET /entries

- Auth: `requireWebAuth`
- Controller: `CodeController`

### GET /mappings

- Auth: `requireWebAuth`
- Controller: `CodeController`

### GET /terms/suggest

- Auth: `requireWebAuth`
- Controller: `CodeController`

### GET /medications/suggest

- Auth: `requireWebAuth`
- Controller: `CodeController`

### GET /mobile/entries

- Auth: `requireMobileAuth`
- Controller: `CodeController`

### GET /mobile/mappings

- Auth: `requireMobileAuth`
- Controller: `CodeController`

### GET /mobile/terms/suggest

- Auth: `requireMobileAuth`
- Controller: `CodeController`

### GET /mobile/medications/suggest

- Auth: `requireMobileAuth`
- Controller: `CodeController`
