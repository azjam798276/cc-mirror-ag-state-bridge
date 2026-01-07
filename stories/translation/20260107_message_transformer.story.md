---
id: "20260107_message_transformer"
difficulty: "medium"
tags: ["translation", "anthropic", "google", "api", "typescript"]
tech_stack: "Node.js 18+, TypeScript 5.x"
---

# User Story
As a developer, I want cc-mirror to translate Anthropic API format to Google Gen AI format, so I can use AG's backend seamlessly.

# Context & Constraints
**Interface Requirements (MessageTransformer):**
```typescript
interface MessageTransformer {
  toGoogleFormat(messages: AnthropicMessage[]): GoogleContent[];
  fromGoogleFormat(content: GoogleContent): AnthropicMessage;
  transformSystemMessage(system: string): GoogleSystemInstruction;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface GoogleContent {
  role: 'user' | 'model';
  parts: Part[];
}
```

**Role Mapping:**
| Anthropic | Google |
|-----------|--------|
| user | user |
| assistant | model |
| system | systemInstruction |

**Content Transformations:**
- Text blocks → `{ text: string }`
- Tool use → `{ functionCall: { name, args } }`
- Tool result → `{ functionResponse: { name, response } }`

# Acceptance Criteria
- [ ] **Role Mapping:** Convert assistant → model correctly
- [ ] **System Message:** Place system in `systemInstruction` field
- [ ] **Text Content:** Transform string content to parts array
- [ ] **Multi-Part:** Handle mixed text/tool content blocks
- [ ] **Tool Calls:** Convert tool_use to functionCall format
- [ ] **Tool Results:** Convert tool_result to functionResponse
- [ ] **Round-Trip:** Preserve semantics in both directions
