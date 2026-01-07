---
name: backend-engineer
description: Backend Engineer for cc-mirror Antigravity Provider and State Bridge
---

# Backend Engineering: cc-mirror Antigravity State Bridge

## Core Principles
1. **Separation of Concerns:** CLI layer is thin (I/O only); business logic lives in provider layer.
2. **Fail-Safe Design:** Missing AG sessions proceed without context; parse failures use generic fallback.
3. **Security First:** OAuth tokens encrypted with AES-256-GCM; keys in OS keychain.
4. **Performance:** <100ms session parse, <500ms e2e latency.

## State Bridge Implementation

### SessionDiscovery
```typescript
class SessionDiscovery {
  findSessions(): Promise<AGSessionMetadata[]>
  getLatestSession(): Promise<AGSessionMetadata | null>
  getSessionById(id: string): Promise<AGSessionMetadata | null>
}
```
- Search paths: `$AG_SESSION_DIR`, `~/.antigravity/sessions`, platform-specific
- Cache results for 1 minute
- Sort by mtime descending

### SessionParser
```typescript
class SessionParser {
  parse(filePath: string): Promise<ParsedSession>
  registerFormat(detector: FormatDetector): void
}
```
- Format detectors: v1, v2, generic fallback
- Size limit: 50MB (throw error above)
- Depth limit: 3 levels for heuristic search

### ContextInjector
```typescript
class ContextInjector {
  buildContextMessage(session: ParsedSession): string
  injectContext(messages: Message[], session: ParsedSession): Message[]
}
```
- Token budget: ~12.5K tokens (50KB chars)
- Truncate completed steps if over budget
- Summarize pending steps if >10

## OAuth & Security

### SecureStorage Pattern
```typescript
// Key hierarchy
OS Keychain → Encryption Key → Token Files (.enc)

// Fallback for headless
Machine ID + PBKDF2 → Deterministic Key (reduced security)
```

### Token Management
- Background refresh queue
- Expiry prediction (refresh 5min before)
- Multi-account support with tier-based selection

## Protocol Translation

### Anthropic → Google Gen AI
- `role: assistant` → `role: model`
- System messages → `systemInstruction`
- Tool results → grouped `functionResponse`

### Streaming
- SSE parsing with chunk transformation
- Backpressure management
- Google → Anthropic format conversion

## Error Handling
```typescript
class StateBridgeError extends Error {
  code: string;
  recoverable: boolean;
}

// Recoverable: proceed without context
// Non-recoverable: abort with clear message
```

## Testing Strategy
- Unit: Mock filesystem, OAuth, HTTP
- Integration: End-to-end flows
- Coverage target: 90%
