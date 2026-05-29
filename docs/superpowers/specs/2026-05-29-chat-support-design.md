# Chat Support Design

**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

Add an AI-powered support chat to the Jowelery platform. Claude Haiku handles all initial conversations. Admins can claim any session and take over as a human agent. Guest users get 3 free messages before being prompted to log in.

---

## Architecture

**Approach:** Stateless DB-backed AI.

For every incoming user message:
1. Load last 10 messages for the session from MongoDB
2. Build Claude context (system prompt + message history)
3. Call `claude-haiku-4-5` via Anthropic SDK
4. Persist user message + AI reply to DB
5. Return AI reply

No in-memory state. Stateless-friendly for Railway deployment.

---

## Data Models (Prisma)

```prisma
model ChatSession {
  id            String       @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken  String       @unique
  userId        String?      @db.ObjectId
  user          User?        @relation(fields: [userId], references: [id])
  status        ChatStatus   @default(AI)
  guestMsgCount Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  messages      ChatMessage[]
}

model ChatMessage {
  id        String      @id @default(auto()) @map("_id") @db.ObjectId
  sessionId String      @db.ObjectId
  session   ChatSession @relation(fields: [sessionId], references: [id])
  role      MessageRole
  content   String
  createdAt DateTime    @default(now())
}

enum ChatStatus {
  AI
  HUMAN
  CLOSED
}

enum MessageRole {
  USER
  AI
  AGENT
}
```

---

## Backend Module: `src/chat/`

### Files

```
src/chat/
  chat.module.ts
  chat.controller.ts
  chat.service.ts
  dto/
    send-message.dto.ts
    admin-reply.dto.ts
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Optional JWT or `sessionToken` body | User sends message; AI replies |
| POST | `/api/chat/link` | JWT required | Link guest session to logged-in user |
| GET | `/api/chat/sessions` | SHOP_ADMIN+ | List all sessions (filter by status) |
| GET | `/api/chat/sessions/:id` | SHOP_ADMIN+ | Get session with full message history |
| PUT | `/api/chat/sessions/:id/claim` | SHOP_ADMIN+ | Claim session (status AI → HUMAN) |
| POST | `/api/chat/sessions/:id/reply` | SHOP_ADMIN+ | Admin sends message to user |
| DELETE | `/api/chat/sessions/:id/reply` | SHOP_ADMIN+ | Close session (status → CLOSED) |

### Guest limit logic (`POST /api/chat`)

- If session has no `userId` and `guestMsgCount >= 3`: return `403 { code: "GUEST_LIMIT" }`
- Otherwise: increment `guestMsgCount` (only when `userId` is null), call Claude, save messages

### `POST /api/chat` request body

```ts
{
  sessionToken: string   // UUID, generated client-side on first open
  message: string        // user's message text
}
```

JWT is read from `Authorization: Bearer` header if present. If valid, `userId` is attached to the session.

### Claude system prompt

```
You are a helpful customer support assistant for Jowelery, a gold jewelry marketplace.

You can help customers with:
- Gold pricing: how prices are calculated (goldRatePerGram × karat_purity × weight + makingCharges × weight)
- Karat options: 24K (pure), 22K, 21K, 18K, 14K
- Product categories: Rings, Necklaces, Bracelets, Earrings, Bars, Coins
- Order status and delivery questions
- Shop information and contact details
- General FAQ about the platform

Rules:
- Always respond in the same language the user writes in (Arabic, English, French, or Urdu)
- Be concise and friendly
- If you cannot answer confidently, say: "Let me connect you with our support team" — do NOT make up information
- Never invent order details, prices, or shop data you were not given
```

---

## Mobile: Client Chat Screen

### File: `src/screens/ChatScreen.tsx`

**Session token:** UUID generated with `uuid` library, stored in `AsyncStorage` under key `chat_session_token`. Persists across app restarts.

**Auth behavior:**
- Guest: sends `sessionToken` only, no `Authorization` header
- Logged in: sends both `sessionToken` + JWT header

**Guest limit UX:**
- Show counter: "X / 3 free questions used" below the input while `guestMsgCount < 3`
- On `403 GUEST_LIMIT` response: hide input, show card:  
  _"Create an account to keep chatting with our support team"_  
  with **Log in** and **Register** buttons

**Session linking (`POST /chat/link`):**
- Called once after successful login if `chat_session_token` exists in AsyncStorage
- Links the guest session to the now-authenticated user, lifting the message limit

**Status indicator:**
- When `session.status === 'HUMAN'`: show green "Connected to support agent" banner above messages
- When `session.status === 'AI'`: no banner (default bot state)
- When `session.status === 'CLOSED'`: show "This conversation has been closed" and disable input

**Polling:** Refresh current session every 5 seconds (same pattern as `AdminChatScreen`).

---

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
```

Add to Railway project env vars and `.env.example`.

---

## Failure Scenarios

| Scenario | Behavior |
|----------|----------|
| Claude API timeout / error | Return `502 { error: "AI unavailable, try again" }` — do NOT save partial messages |
| Invalid `sessionToken` format | `400` — validate UUID format in DTO |
| Guest sends 4th message | `403 { code: "GUEST_LIMIT" }` |
| Admin claims already-HUMAN session | `409 { error: "Session already claimed" }` |
| Admin replies to CLOSED session | `400 { error: "Session is closed" }` |

---

## Security

- `sessionToken` is a client-generated UUID — no secrets in it, safe to expose
- Message content is sanitized (strip HTML) before sending to Claude and saving to DB
- Claude response is treated as untrusted text — rendered as plain text only, never as HTML/markdown in the mobile UI
- Rate limit `POST /api/chat`: 10 requests/minute per IP (using `@nestjs/throttler`)
- Admin endpoints (`/sessions/*`) require `SHOP_ADMIN` role — enforced by `RolesGuard`
