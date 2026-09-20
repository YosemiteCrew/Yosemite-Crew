---
id: backend-api-marketing
title: Marketing API
slug: /apps/backend/api/marketing
---

Serves marketing data consumed by the public site. Currently a single endpoint returning the current Discord community member count; the response is cached for five minutes.

**Endpoints**

### GET /discord-members

- Controller: `MarketingController.getDiscordMembers`
- Response: `200`: keys `discordMembers` (cached, `Cache-Control: public, max-age=300, stale-while-revalidate=300`)
