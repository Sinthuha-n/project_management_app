# Migrate direct-message participants to User-ID references

Status: Follow-up

## Problem

Direct-message sender and recipient fields are stored and queried as mutable string aliases. Username or email changes can therefore detach historical messages from a conversation.

## Scope

- Add stable sender and recipient User-ID references to the direct-message schema.
- Backfill existing messages by resolving stored username/email aliases, with an explicit report for ambiguous or unresolved rows.
- Switch conversation, latest-message, unread-count, search-visibility, and ownership queries to User IDs.
- Keep the existing sender/recipient strings during a compatibility rollout, then remove alias lookup after all clients and data are migrated.
- Preserve the REST message payload and WebSocket contract unless a separately versioned contract change is approved.

## Acceptance criteria

- Historical DMs remain visible after either participant changes username or email.
- DM reads and unread counts use User IDs exclusively.
- Migration handles unresolved legacy aliases without silently dropping messages.
- Existing REST and WebSocket contract tests continue to pass.

## Context

The incremental guard in `ChatService` normalizes aliases, emits `dm_conversation_alias_lookup_empty`, and retries latest-message lookup with canonical usernames. It reduces immediate risk but does not remove the underlying alias dependency.
