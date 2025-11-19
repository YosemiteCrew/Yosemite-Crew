---
id: backend-chat-implementation
title: Backend Chat Implementation
slug: /guides/backend-chat
---

(Source: Guides/BACKEND_CHAT_IMPLEMENTATION.md)

# Stream Chat Backend Implementation Guide

## Overview

This guide is for backend engineers implementing Stream Chat token generation, channel management, and webhook handlers for the Yosemite Crew veterinary app.

**Current Status**: Frontend implementation is complete and working. Backend needs to replace mock services with real API endpoints.

---

## Architecture

### Current Flow (Development)
```
Mobile App → Uses Mock Services (devToken) → Stream Cloud
Web App    → Uses Mock Services (devToken) → Stream Cloud
```

### Required Flow (Production)
```
Mobile App → Request Token → Backend API → Stream Cloud
Web App    → Request Token → Backend API → Stream Cloud
Backend    → Uses API Secret to Create Channels & Tokens
```

---

## Prerequisites

1. **Stream Account**: https://getstream.io/chat/
2. **API Credentials**:
   - API Key (expose to frontend)
   - API Secret (keep secure on backend only)
3. **Node.js >= 20**
4. **Backend Framework**: Express, NestJS, or your preference

---

## Required Endpoints

### 1. Generate Stream User Token

**Purpose**: Create secure authentication tokens for users to connect to Stream Chat

**Endpoint**:
```
POST /api/chat/token
```

**Request**:
```typescript
{
  userId: string;  // User ID from your auth system
}
```

**Response**:
```typescript
{
  token: string;
  expiresAt: number;  // Unix timestamp
}
```

**Implementation** (Express.js):
```javascript
const StreamChat = require('stream-chat').StreamChat;

app.post('/api/chat/token', async (req, res) => {
  try {
    const { userId } = req.body;

    // Verify user is authenticated
    const user = req.user;  // From auth middleware
    if (!user || user.id !== userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Initialize Stream server client
    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // Generate token (expires in 24 hours)
    const token = serverClient.createToken(userId);

    res.json({
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error('[Stream] Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});
```

**Frontend Usage**:
```typescript
// Mobile App - in streamChatService.ts
export const connectStreamUser = async (
  userId: string,
  userName: string,
  userImage?: string,
) => {
  const client = getChatClient();

  if (client.userID === userId) {
    return client;
  }

  try {
    // Get token from backend
    const response = await fetch('/api/chat/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const { token } = await response.json();

    await client.connectUser(
      {
        id: userId,
        name: userName,
        image: userImage,
      },
      token  // Use backend-generated token
    );

    return client;
  } catch (error) {
    console.error('[Stream] Failed to connect user:', error);
    throw error;
  }
};
```

---

### 2. Create or Get Appointment Channel

**Purpose**: Create a chat channel for an appointment or retrieve existing one

**Endpoint**:
```
POST /api/chat/channels
```

**Request**:
```typescript
{
  appointmentId: string;
  petOwnerId: string;
  vetId: string;
  appointmentTime: string;  // ISO 8601 format
  activationMinutes?: number;  // Default: 5
}
```

**Response**:
```typescript
{
  channelId: string;
  channelType: 'messaging';
  members: string[];
}
```

**Implementation**:
```javascript
app.post('/api/chat/channels', async (req, res) => {
  try {
    const {
      appointmentId,
      petOwnerId,
      vetId,
      appointmentTime,
      activationMinutes = 5,
    } = req.body;

    // Verify appointment exists and user has access
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify vet owns this appointment
    if (appointment.vetId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    const channelId = `appointment-${appointmentId}`;

    // Create channel
    const channel = serverClient.channel('messaging', channelId, {
      name: `Chat with ${appointment.petOwnerName || 'Pet Owner'}`,
      members: [petOwnerId, vetId],
      appointmentId,
      appointmentTime,
      activationMinutes,
      status: 'active',
      created_by_id: vetId,
    });

    await channel.create();

    // Store channel reference in database (optional but recommended)
    await Appointment.updateOne(
      { _id: appointmentId },
      {
        chatChannelId: channelId,
        chatStatus: 'active',
      }
    );

    res.json({
      channelId,
      channelType: 'messaging',
      members: [petOwnerId, vetId],
    });
  } catch (error) {
    console.error('[Stream] Channel creation error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});
```

**Frontend Usage**:
```typescript
// Mobile App - in streamChatService.ts
export const getAppointmentChannel = async (
  appointmentId: string,
  vetId: string,
  appointmentData?: any,
) => {
  const client = getChatClient();

  if (!client.userID) {
    throw new Error('User must be connected before accessing channels');
  }

  try {
    // Request channel from backend
    const response = await fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId,
        petOwnerId: client.userID,
        vetId,
        appointmentTime: appointmentData?.dateTime,
        activationMinutes: 5,
      }),
    });

    const { channelId } = await response.json();

    // Get channel reference
    const channel = client.channel('messaging', channelId);
    await channel.watch();

    return channel;
  } catch (error) {
    console.error('[Stream] Failed to get channel:', error);
    throw error;
  }
};
```

---

### 3. End/Close Chat Channel

**Purpose**: Manually close a chat channel (called by PMS when appointment ends)

**Endpoint**:
```
POST /api/chat/channels/:channelId/end
```

**Response**:
```typescript
{
  success: boolean;
}
```

**Implementation**:
```javascript
app.post('/api/chat/channels/:channelId/end', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Verify user is vet and has access to this channel
    const appointment = await Appointment.findOne({
      chatChannelId: channelId,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (appointment.vetId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    const channel = serverClient.channel('messaging', channelId);

    // Send system message
    await channel.sendMessage({
      text: 'This chat has been ended by the veterinary practice.',
      user_id: 'system',
    });

    // Update channel status
    await channel.update({
      status: 'ended',
      frozen: true,  // Optional: prevent new messages
    });

    // Update database
    await Appointment.updateOne(
      { _id: appointment._id },
      { chatStatus: 'ended' }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Stream] Channel end error:', error);
    res.status(500).json({ error: 'Failed to end channel' });
  }
});
```

---

### 4. Get Active Channels for User

**Purpose**: Fetch all active chat channels for a user (used by web PMS to show chat list)

**Endpoint**:
```
GET /api/chat/channels
```

**Query Parameters**:
```typescript
{
  role?: 'pet-owner' | 'vet';  // Optional filter
}
```

**Response**:
```typescript
{
  channels: Array<{
    id: string;
    name: string;
    members: string[];
    lastMessage?: string;
    lastMessageAt?: number;
    appointmentId: string;
    status: 'active' | 'ended';
  }>;
}
```

**Implementation**:
```javascript
app.get('/api/chat/channels', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // Query channels where user is a member
    const filter = {
      type: 'messaging',
      members: { $in: [userId] },
    };

    const sort = [{ last_message_at: -1 }];

    const channels = await serverClient.queryChannels(filter, sort, {
      watch: true,
      state: true,
      presence: true,
      limit: 100,
    });

    // Transform response
    const response = channels.map((ch) => ({
      id: ch.id,
      name: ch.data?.name || 'Chat',
      members: ch.members,
      lastMessage: ch.state.latestMessages[0]?.text,
      lastMessageAt: ch.state.latestMessages[0]?.created_at,
      appointmentId: ch.data?.appointmentId,
      status: ch.data?.status || 'active',
    }));

    res.json({ channels: response });
  } catch (error) {
    console.error('[Stream] Get channels error:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});
```

---

### 5. Webhook Handler (Optional but Recommended)

**Purpose**: Receive real-time events from Stream (new messages, channel updates, etc.)

**Setup in Stream Dashboard**:
1. Go to Stream Dashboard → Your App
2. Click "Webhooks" or "Integrations"
3. Add webhook URL: `https://yourbackend.com/api/webhooks/stream`
4. Select events: `message.new`, `channel.deleted`, `user.updated`

**Endpoint**:
```
POST /api/webhooks/stream
```

**Implementation**:
```javascript
const crypto = require('crypto');

app.post('/api/webhooks/stream', (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-signature'];
    const body = JSON.stringify(req.body);

    const hash = crypto
      .createHmac('sha256', process.env.STREAM_API_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== hash) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    // Handle different event types
    switch (event.type) {
      case 'message.new':
        handleNewMessage(event);
        break;

      case 'channel.deleted':
        handleChannelDeleted(event);
        break;

      case 'user.updated':
        handleUserUpdated(event);
        break;

      default:
        console.log('[Stream] Unhandled event type:', event.type);
    }

    // Always return 200 to acknowledge webhook
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Error handling stream event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handler functions
async function handleNewMessage(event) {
  console.log('[Webhook] New message in channel:', event.cid);

  // Get channel and message details
  const { channel_type, channel_id, message } = event;

  // Example: Send push notification to recipient
  const appointment = await Appointment.findOne({
    chatChannelId: `${channel_type}-${channel_id}`,
  });

  if (appointment) {
    // Send notification to recipient (vet or pet owner)
    const recipientId =
      message.user.id === appointment.petOwnerId
        ? appointment.vetId
        : appointment.petOwnerId;

    // Use your notification service (Firebase, Twilio, etc.)
    // await sendPushNotification(recipientId, {
    //   title: 'New Message',
    //   body: message.text || '[Media Message]',
    //   data: { appointmentId: appointment.id },
    // });
  }
}

async function handleChannelDeleted(event) {
  console.log('[Webhook] Channel deleted:', event.cid);

  // Clean up database references if needed
  // await Appointment.updateOne(
  //   { chatChannelId: event.cid },
  //   { chatStatus: 'deleted' }
  // );
}

async function handleUserUpdated(event) {
  console.log('[Webhook] User updated:', event.user.id);

  // Handle user updates (e.g., profile picture change)
  // This is optional based on your needs
}
```

---

## Environment Variables

Add these to your backend `.env` file:

```bash
# Stream Chat Credentials
STREAM_API_KEY=your_api_key_here
STREAM_API_SECRET=your_api_secret_here

# Database
MONGODB_URI=mongodb://...
DATABASE_NAME=yosemite_crew

# Auth
JWT_SECRET=your_jwt_secret_here
```

---

## Database Schema Updates

Update your Appointment model to include chat references:

```typescript
// Appointment model
{
  // ... existing fields
  chatChannelId?: string;           // Stream channel ID
  chatStatus?: 'pending' | 'active' | 'ended';  // Chat lifecycle status
  chatActivationMinutes?: number;   // Default: 5 (when chat unlocks)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Current Frontend Implementation

### Mobile App (React Native)

**Files**:
- `apps/mobileAppYC/src/features/chat/services/streamChatService.ts` - Stream client
- `apps/mobileAppYC/src/features/chat/screens/ChatChannelScreen.tsx` - Chat UI
- `apps/mobileAppYC/src/shared/services/mockStreamBackend.ts` - Mock service (replace with API calls)

**Key Functions to Update**:
1. `connectStreamUser()` - Get token from `/api/chat/token`
2. `getAppointmentChannel()` - Create channel via `/api/chat/channels`

### Web App (Next.js)

**Files**:
- `apps/frontend/src/app/services/streamChatService.ts` - Stream client
- `apps/frontend/src/app/components/chat/ChatContainer.tsx` - Chat UI
- `apps/frontend/src/app/utils/mockStreamBackend.ts` - Mock service (replace with API calls)

**Key Functions to Update**:
1. `connectStreamUser()` - Get token from `/api/chat/token`
2. Add chat channel listing (uses `/api/chat/channels` GET endpoint)

---

## Integration Steps

1. **Install Stream SDK on Backend**:
   ```bash
   npm install stream-chat
   ```

2. **Implement All 5 Endpoints** (use examples above)

3. **Configure Environment Variables**

4. **Update Frontend Mock Services**:
   - Replace `mockStreamBackend.ts` calls with HTTP requests to your endpoints
   - Keep all existing frontend code unchanged

5. **Test End-to-End**:
   - Mobile app sends token request → Backend generates → Chat connects
   - Web app lists channels → Backend queries Stream → List appears
   - Send message → Webhook triggered → Push notification sent

6. **Configure Webhooks** (optional but recommended):
   - Set webhook URL in Stream Dashboard
   - Backend receives events from Stream

---

## Security Checklist

- ✅ Never expose `STREAM_API_SECRET` to frontend
- ✅ Always verify user authentication before token generation
- ✅ Validate appointment access (user owns appointment or is vet)
- ✅ Use HTTPS for all API endpoints
- ✅ Implement rate limiting on token endpoint
- ✅ Verify webhook signatures from Stream
- ✅ Sanitize user input before sending to Stream
- ✅ Use environment variables for all credentials

---

## Testing

### Test Token Generation
```bash
curl -X POST http://localhost:3000/api/chat/token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"userId": "user-123"}'
```

### Test Channel Creation
```bash
curl -X POST http://localhost:3000/api/chat/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "appointmentId": "apt-123",
    "petOwnerId": "owner-1",
    "vetId": "vet-1",
    "appointmentTime": "2025-01-15T14:00:00Z"
  }'
```

### Test Get Channels
```bash
curl -X GET http://localhost:3000/api/chat/channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Deployment Notes

- Stream Cloud handles all message delivery and persistence
- Your backend only manages authentication and channel creation
- No need to deploy Stream locally
- Use Stream Dashboard for monitoring and management

---

## Support

- Stream Docs: https://getstream.io/chat/docs/api/
- Community: https://getstream.io/chat/docs/sdk/react-native/#community

---

**Backend implementation is ready to start!** 🚀
