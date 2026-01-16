# Stream Chat Backend Implementation Guide

## Overview

This guide is for backend engineers implementing Stream Chat token generation, channel management, and webhook handlers for the Yosemite Crew veterinary app.

**Current Status**: Frontend implementation is complete and working. Backend needs to replace mock services with real API endpoints and supply metadata for the new chat audiences:
- **Clients** (pet parents + PMS staff on appointments)
- **Colleagues** (internal PMS employee 1:1 chat)
- **Common Groups** (shared rooms/announcements per business)

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

## Channel Metadata (frontend expectations)

To power the new chat audience pills on the web app, set these fields whenever you create or update a channel:

- `chatCategory`: one of `client` | `colleague` | `group`
- `orgId`: business/org identifier (used for colleague/group scoping)
- `isGroup`: boolean flag for group rooms (also set `member_count` if available)
- `appointmentId`, `petOwnerName`, `petName`: keep these on appointment/client chats for accurate labels
- `status`: `'active' | 'ended'` (frontend shows “Session closed” if `status` is `'ended'` or `frozen` is `true`)

Channels without `chatCategory` will default to `colleague` on the frontend, so set it explicitly for client chats to keep them grouped correctly.

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

### 3. Create or Get Internal Staff Channel (Colleague → Colleague)

**Purpose**: Allow PMS employees to chat with each other (1:1) inside a business.

**Endpoint**:
```
POST /api/chat/channels/internal
```

**Request**:
```typescript
{
  orgId: string;
  memberIds: [string, string]; // exactly two users
  createdBy: string;           // user id creating the channel
}
```

**Implementation**:
```javascript
app.post('/api/chat/channels/internal', async (req, res) => {
  try {
    const { orgId, memberIds, createdBy } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length !== 2) {
      return res.status(400).json({ error: 'Exactly two members required' });
    }

    // Authorize creator belongs to org
    if (!req.user || req.user.orgId !== orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // Idempotent: reuse existing DM for this pair if it exists
    const sortedMembers = [...memberIds].sort();
    const existing = await serverClient.queryChannels(
      {
        type: 'messaging',
        chatCategory: 'colleague',
        orgId,
        members: { $eq: sortedMembers },
      },
      [{ last_message_at: -1 }],
      { limit: 1 }
    );

    if (existing.length) {
      const ch = existing[0];
      return res.json({ channelId: ch.id, channelType: 'messaging', members: sortedMembers });
    }

    const channelId = `staff-${orgId}-${sortedMembers.join('-')}`;

    const channel = serverClient.channel('messaging', channelId, {
      name: 'Team chat',
      members: sortedMembers,
      orgId,
      chatCategory: 'colleague',
      isGroup: false,
      created_by_id: createdBy,
      status: 'active',
    });

    await channel.create();
    res.json({ channelId, channelType: 'messaging', members: sortedMembers });
  } catch (error) {
    console.error('[Stream] Internal channel error:', error);
    res.status(500).json({ error: 'Failed to create staff channel' });
  }
});
```

**Frontend flow**: User types in search (section 5) → selects a colleague → call this endpoint to reuse/create the DM → channel then appears in the colleague list via the standard channel query.

---

### 4. Create or Get Group Channel (Common room)

**Purpose**: A shared room for all PMS teammates (and optionally clients) inside an org, with optional avatar and controlled membership.

**Endpoint**:
```
POST /api/chat/channels/group
```

**Request**:
```typescript
{
  orgId: string;
  name: string;
  memberIds: string[];   // at least two
  createdBy: string;
  isReadOnly?: boolean;  // optional broadcast-only mode
  image?: string;        // optional group avatar URL
  channelId?: string;    // optional slug/ID; if absent, backend should slugify name
}
```

**Implementation**:
```javascript
app.post('/api/chat/channels/group', async (req, res) => {
  try {
    const {
      orgId,
      name,
      memberIds,
      createdBy,
      isReadOnly = false,
      image,
      channelId: channelIdInput,
    } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'At least two members required' });
    }

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const channelId = channelIdInput || `group-${orgId}-${slug}`;

    const channel = serverClient.channel('messaging', channelId, {
      name,
      members: memberIds,
      orgId,
      chatCategory: 'group',
      isGroup: true,
      status: 'active',
      created_by_id: createdBy,
      read_only: isReadOnly,
      image,
    });

    await channel.create();
    res.json({ channelId, channelType: 'messaging', members: memberIds });
  } catch (error) {
    console.error('[Stream] Group channel error:', error);
    res.status(500).json({ error: 'Failed to create group channel' });
  }
});
```

**Frontend flow**: "Create group" modal collects name, optional image URL, and members (from the search endpoint). Call this endpoint to create the group, then call the member update endpoint (section 6) for any subsequent adds/removals.

---

### 5. Search Organisation Colleagues (typeahead for DM and group picker)

**Purpose**: Typeahead search so users can find a teammate by name/email before starting a DM or adding them to a group. UI only shows results, not the entire org list by default.

**Endpoint**:
```
GET /api/orgs/:orgId/search
```

**Query Parameters**:
```typescript
{
  query: string;       // partial name/email
  limit?: number;      // default 10
}
```

**Response**:
```typescript
{
  results: Array<{
    id: string;
    name: string;
    email?: string;
    image?: string;
    role?: string;
  }>;
}
```

**Implementation**:
```javascript
app.get('/api/orgs/:orgId/search', async (req, res) => {
  const { orgId } = req.params;
  const { query, limit = 10 } = req.query;

  if (!query || String(query).trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  if (!req.user || req.user.orgId !== orgId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const results = await UserOrgMapping.find({
    orgId,
    $or: [
      { 'user.firstName': new RegExp(query, 'i') },
      { 'user.lastName': new RegExp(query, 'i') },
      { 'user.email': new RegExp(query, 'i') },
    ],
  })
    .limit(Number(limit))
    .populate('user');

  res.json({
    results: results.map((m) => ({
      id: m.user._id.toString(),
      name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
      email: m.user.email,
      image: m.user.avatarUrl,
      role: m.role,
    })),
  });
});
```

**Frontend flow**: Use this for both DM typeahead and the group member picker; when a user is selected, call the DM endpoint (section 3) or the group member endpoint (section 6).

---

### 6. Add or Remove Group Members (post-creation)

**Purpose**: Allow a creator/admin to add/remove members when editing a group (used by the group creation UI and later member management).

**Endpoint**:
```
POST /api/chat/channels/group/:channelId/members
```

**Request**:
```typescript
{
  add?: string[];       // user IDs to add
  remove?: string[];    // user IDs to remove
  addedBy: string;      // user performing the action (for audit)
}
```

**Implementation**:
```javascript
app.post('/api/chat/channels/group/:channelId/members', async (req, res) => {
  const { channelId } = req.params;
  const { add = [], remove = [], addedBy } = req.body;

  if (!req.user || req.user.id !== addedBy) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
  );

  const channel = serverClient.channel('messaging', channelId);

  if (add.length) {
    await channel.addMembers(add, { text: `${addedBy} added members` });
  }

  if (remove.length) {
    await channel.removeMembers(remove, { text: `${addedBy} removed members` });
  }

  res.json({ success: true });
});
```

**Frontend flow**: After creating a group (or when editing), call this endpoint to add/remove selected users from the search endpoint. The channel list will reflect membership on the next query.

---

### 7. List Organisation Colleagues (for “Colleagues” audience)

**Purpose**: Let the PMS frontend show all teammates who can be added to internal chats.

**Endpoint**:
```
GET /api/orgs/:orgId/members
```

**Response**:
```typescript
{
  members: Array<{
    id: string;
    name: string;
    email?: string;
    image?: string;
    role?: string;
  }>;
}
```

**Implementation** (example using Mongo):
```javascript
app.get('/api/orgs/:orgId/members', async (req, res) => {
  const { orgId } = req.params;

  // Ensure requester belongs to this org
  if (!req.user || req.user.orgId !== orgId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const members = await UserOrgMapping.find({ orgId }).populate('user');
  const payload = members.map((m) => ({
    id: m.user._id.toString(),
    name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
    email: m.user.email,
    image: m.user.avatarUrl,
    role: m.role,
  }));

  res.json({ members: payload });
});
```

---

### 8. List Group Channels for an Org

**Purpose**: Fetch common rooms/broadcast channels per business to populate the “Common Groups” tab.

**Endpoint**:
```
GET /api/chat/channels/groups?orgId=:orgId
```

**Response**:
```typescript
{
  channels: Array<{
    id: string;
    name: string;
    members: string[];
    status: 'active' | 'ended';
    isGroup: true;
    chatCategory: 'group';
  }>;
}
```

**Implementation**:
```javascript
app.get('/api/chat/channels/groups', async (req, res) => {
  const { orgId } = req.query;
  const userId = req.user.id;

  if (!orgId) {
    return res.status(400).json({ error: 'orgId is required' });
  }

  const serverClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET
  );

  const filter = {
    type: 'messaging',
    chatCategory: 'group',
    orgId,
    members: { $in: [userId] },
  };

  const channels = await serverClient.queryChannels(filter, [{ last_message_at: -1 }], {
    watch: true,
    state: true,
    presence: true,
  });

  res.json({
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.data?.name || 'Group',
      members: ch.members.map((m) => m.user_id),
      status: ch.data?.status || 'active',
      isGroup: true,
      chatCategory: 'group',
    })),
  });
});
```

---

### 9. End/Close Chat Channel

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

### 10. Get Active Channels for User

**Purpose**: Fetch all active chat channels for a user (used by web PMS to show chat list)

**Endpoint**:
```
GET /api/chat/channels
```

**Query Parameters**:
```typescript
{
  role?: 'pet-owner' | 'vet';     // Optional filter
  category?: 'client' | 'colleague' | 'group'; // For UI pills
  orgId?: string;                 // Scope internal/group chats to an org
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
    chatCategory?: 'client' | 'colleague' | 'group';
    orgId?: string;
    isGroup?: boolean;
  }>;
}
```

**Implementation**:
```javascript
app.get('/api/chat/channels', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { category, orgId } = req.query;

    const serverClient = StreamChat.getInstance(
      process.env.STREAM_API_KEY,
      process.env.STREAM_API_SECRET
    );

    // Query channels where user is a member
    const filter = {
      type: 'messaging',
      members: { $in: [userId] },
    };

    if (category) {
      filter.chatCategory = category;
    }

    if (orgId) {
      filter.orgId = orgId;
    }

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
      chatCategory: ch.data?.chatCategory || ch.data?.category,
      orgId: ch.data?.orgId,
      isGroup: ch.data?.isGroup === true || ch.state?.members?.length > 2,
    }));

    res.json({ channels: response });
  } catch (error) {
    console.error('[Stream] Get channels error:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});
```

---

### 11. Webhook Handler (Optional but Recommended)

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
3. Supply `chatCategory` metadata so the web pills (Clients / Colleagues / Common Groups) filter correctly

---

## Integration Steps

1. **Install Stream SDK on Backend**:
   ```bash
   npm install stream-chat
   ```

2. **Implement All 11 Endpoints** (token, appointment, DM creation, group creation, typeahead search, group membership updates, list colleagues, list groups, close chat, user channel list, webhook)

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

### Test Internal Staff Channel
```bash
curl -X POST http://localhost:3000/api/chat/channels/internal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orgId": "org-1",
    "memberIds": ["vet-1", "tech-2"],
    "createdBy": "vet-1"
  }'
```

### Test Group Channel
```bash
curl -X POST http://localhost:3000/api/chat/channels/group \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orgId": "org-1",
    "name": "Announcements",
    "memberIds": ["vet-1", "tech-2", "frontdesk-3"],
    "createdBy": "vet-1",
    "isReadOnly": true
  }'
```

### Test Search Colleagues (typeahead)
```bash
curl -X GET "http://localhost:3000/api/orgs/org-1/search?query=har&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Add Group Members
```bash
curl -X POST http://localhost:3000/api/chat/channels/group/group-org-1-announcements/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "add": ["tech-3"],
    "remove": [],
    "addedBy": "vet-1"
  }'
```

### Test List Colleagues
```bash
curl -X GET http://localhost:3000/api/orgs/org-1/members \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test List Group Channels
```bash
curl -X GET "http://localhost:3000/api/chat/channels/groups?orgId=org-1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
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
