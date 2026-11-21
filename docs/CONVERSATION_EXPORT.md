# Conversation export

The conversation export endpoint allows authenticated users to download a full conversation transcript for their organization.

## API

### `GET /api/v1/conversations/:id/export`

Requires authentication. Returns a JSON attachment containing:

- `conversation` - conversation metadata
- `messages` - messages ordered by creation time
- `exportedAt` - export timestamp

The response is sent as `conversation-<id>.json`. Each export writes an `conversation.export` audit event with the message count.

## Console

The AI Assistant displays an **Export** button when a conversation is active, downloading the conversation JSON through the authenticated API.
