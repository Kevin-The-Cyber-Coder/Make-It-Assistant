# Conversation metrics

The conversation metrics endpoint summarizes organization-scoped AI conversation activity.

## API

### `GET /api/v1/conversations/metrics`

Requires authentication. Returns:

- `totalConversations` - total conversations in the organization
- `totalMessages` - total messages in the organization
- `activeLast24h` - conversations updated in the last 24 hours
- `avgMessagesPerConversation` - average messages per conversation

## Console

The AI Assistant workspace displays conversation, message, recent activity, and average message-count telemetry above the chat interface.
