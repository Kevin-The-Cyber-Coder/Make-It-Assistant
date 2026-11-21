# Conversation update

## API

### `PATCH /api/v1/conversations/:id`

Requires authentication. Updates a conversation title within the authenticated organization.

Body:

```json
{ "title": "New title" }
```

Returns the updated conversation. Each update writes a `conversation.update` audit event.
