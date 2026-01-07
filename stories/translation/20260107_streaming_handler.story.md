---
id: "20260107_streaming_handler"
difficulty: "medium"
tags: ["translation", "streaming", "sse", "api", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x, node-fetch"
---

# User Story
As a developer, I want streaming responses from AG's API converted to Anthropic format, so Claude Code CLI displays them correctly.

# Context & Constraints
**Interface Requirements (StreamingHandler):**
```typescript
interface StreamingHandler {
  parseGoogleSSE(stream: ReadableStream): AsyncGenerator<StreamChunk>;
  toAnthropicChunk(googleEvent: GoogleStreamEvent): AnthropicStreamEvent;
}

interface StreamChunk {
  type: 'content_block_delta' | 'message_stop' | 'error';
  delta?: { text: string };
  error?: Error;
}
```

**Google SSE Format:**
```
data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}
data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}
data: [DONE]
```

**Anthropic SSE Format:**
```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

# Acceptance Criteria
- [ ] **SSE Parsing:** Parse `data: {...}` lines from stream
- [ ] **Chunk Conversion:** Convert Google candidates to Anthropic deltas
- [ ] **Stream End:** Emit message_stop on `[DONE]` signal
- [ ] **Error Handling:** Convert Google errors to Anthropic error events
- [ ] **Backpressure:** Handle slow consumers without memory leak
- [ ] **Partial Lines:** Buffer incomplete lines across chunks
- [ ] **UTF-8:** Handle multi-byte characters split across chunks
