# 📘 TECHNICAL DESIGN DOCUMENT (TDD)
**Project:** cc-mirror Antigravity State Bridge  
**Version:** 1.0 (Draft)  
**Date:** January 7, 2026, 2:00 PM SGT  
**Author:** Tech Lead  
**Status:** DRAFT - Under Review  

***

## 🎯 TECH LEAD INTRODUCTION

**Author:** Tech Lead  
**Date:** January 7, 2026, 2:00 PM  

This TDD translates the approved PRD and ADD into concrete implementation specifications. It defines:

1. **Detailed API Contracts** - Every public method signature
2. **Data Structures** - Exact TypeScript interfaces
3. **Algorithms** - Step-by-step implementation logic
4. **File Organization** - Where code lives in the repository
5. **Testing Strategy** - What to test and how

**Target Audience:** Backend engineers implementing the system

***

## 📁 Repository Structure

```
cc-mirror/
├── src/
│   ├── providers/
│   │   ├── antigravity/                    # NEW MODULE
│   │   │   ├── index.ts                   # Public exports
│   │   │   ├── antigravity-provider.ts    # Main provider class
│   │   │   │
│   │   │   ├── state-bridge/              # State Bridge Subsystem
│   │   │   │   ├── session-discovery.ts   
│   │   │   │   ├── session-parser.ts      
│   │   │   │   ├── context-injector.ts    
│   │   │   │   ├── format-detectors/      
│   │   │   │   │   ├── v1-detector.ts     
│   │   │   │   │   ├── v2-detector.ts     
│   │   │   │   │   └── generic-detector.ts
│   │   │   │   └── types.ts               
│   │   │   │
│   │   │   ├── oauth/                     # OAuth Subsystem
│   │   │   │   ├── oauth-manager.ts       
│   │   │   │   ├── token-manager.ts       
│   │   │   │   ├── secure-storage.ts      
│   │   │   │   ├── callback-server.ts     
│   │   │   │   └── types.ts               
│   │   │   │
│   │   │   ├── translation/               # Protocol Translation
│   │   │   │   ├── message-transformer.ts 
│   │   │   │   ├── streaming-handler.ts   
│   │   │   │   ├── api-client.ts          
│   │   │   │   └── types.ts               
│   │   │   │
│   │   │   ├── enhancement/               # Tool/Thinking Features
│   │   │   │   ├── tool-hardener.ts       
│   │   │   │   ├── thinking-sanitizer.ts  
│   │   │   │   └── types.ts               
│   │   │   │
│   │   │   ├── account/                   # Account Management
│   │   │   │   ├── account-pool.ts        
│   │   │   │   ├── tier-manager.ts        
│   │   │   │   ├── quota-tracker.ts       
│   │   │   │   └── types.ts               
│   │   │   │
│   │   │   ├── config/                    # Configuration
│   │   │   │   ├── antigravity-config.ts  
│   │   │   │   └── constants.ts           
│   │   │   │
│   │   │   └── utils/                     # Utilities
│   │   │       ├── logger.ts              
│   │   │       ├── telemetry.ts           
│   │   │       └── errors.ts              
│   │   │
│   │   └── provider-interface.ts          # Existing interface
│   │
│   └── cli/
│       ├── commands/
│       │   ├── send.ts                    # MODIFY: Add --continue-from-ag
│       │   └── antigravity/               # NEW COMMANDS
│       │       ├── login.ts               
│       │       ├── logout.ts              
│       │       ├── list-sessions.ts       
│       │       └── show-session.ts        
│       │
│       └── index.ts                       # CLI entry point
│
├── tests/
│   ├── unit/
│   │   └── providers/
│   │       └── antigravity/               # Mirror src structure
│   ├── integration/
│   │   └── antigravity-provider.test.ts   
│   └── fixtures/
│       └── ag-sessions/                   # Mock AG session files
│           ├── simple-v1.json             
│           ├── complex-v1.json            
│           └── large-session.json         
│
├── docs/
│   └── antigravity/
│       ├── setup-guide.md                 
│       ├── troubleshooting.md             
│       └── api-reference.md               
│
└── package.json                           # Add dependencies
```

***

## 📘 STREAMLINED MODULE SPECIFICATIONS

### Module 1: SessionDiscovery

**Purpose:** Find AG session files on filesystem

**Public API:**
```typescript
class SessionDiscovery {
  findSessions(): Promise<AGSessionMetadata[]>
  getLatestSession(): Promise<AGSessionMetadata | null>
  getSessionById(id: string): Promise<AGSessionMetadata | null>
  clearCache(): void
}

interface AGSessionMetadata {
  sessionId: string;
  filePath: string;
  timestamp: Date;
  sizeBytes: number;
  ageString?: string;
}
```

**Algorithm:**
1. Search paths: `$AG_SESSION_DIR`, `~/.antigravity/sessions`, platform-specific
2. Filter `.json` files
3. Extract metadata via `fs.stat`
4. Cache results for 1 minute
5. Sort by mtime descending

**Edge Cases:**
- No sessions found → return `[]`
- Permission denied → skip path, continue
- Malformed filename → extract ID heuristically

***

### Module 2: SessionParser

**Purpose:** Parse AG session JSON into structured data

**Public API:**
```typescript
class SessionParser {
  parse(filePath: string): Promise<ParsedSession>
  registerFormat(detector: FormatDetector): void
}

interface ParsedSession {
  sessionId: string;
  goal: string;
  planSteps: PlanStep[];
  currentStep: number;
  completedSteps: PlanStep[];
  pendingSteps: PlanStep[];
  filesModified: string[];
  variables: Record<string, any>;
}
```

**Algorithm:**
1. Check file size → if >50MB, throw error
2. Read file content via `fs.readFile`
3. Parse JSON
4. Try format detectors (v1, v2, generic)
5. Return `ParsedSession`

**Edge Cases:**
- File >50MB → throw `SessionParseError`
- Invalid JSON → throw `SessionParseError`
- Unknown format → use generic parser

***

### Module 3: ContextInjector

**Purpose:** Build context message from parsed session

**Public API:**
```typescript
class ContextInjector {
  buildContextMessage(session: ParsedSession): string
  injectContext(messages: Message[], session: ParsedSession): Message[]
}
```

**Algorithm:**
1. Build sections: header, goal, progress, steps, files
2. Estimate tokens (rough: `length * 0.25`)
3. Truncate if >50K chars
4. Create system message, prepend to array

***

### Module 4: OAuthManager

**Purpose:** Handle Google OAuth 2.0 flow

**Public API:**
```typescript
class OAuthManager {
  initiateAuth(): Promise<string>
  handleCallback(code: string): Promise<void>
  getValidToken(email?: string): Promise<string>
  listAccounts(): Promise<string[]>
  logout(email: string): Promise<void>
}
```

**Algorithm:**
1. Start callback server on `localhost:51121`
2. Generate auth URL with `google-auth-library`
3. Open browser, wait for callback
4. Exchange code for tokens, encrypt, store

***

### Module 5: SecureStorage

**Purpose:** Encrypt/decrypt OAuth tokens at rest

**Public API:**
```typescript
class SecureStorage {
  encrypt(data: any): Promise<EncryptedData>
  decrypt(encrypted: EncryptedData): Promise<any>
}
```

**Algorithm:**
- AES-256-GCM encryption
- Key from OS keychain (keytar) or machine-id fallback

***

### Module 6: MessageTransformer

**Purpose:** Convert Anthropic API format to Google Gen AI format

**Public API:**
```typescript
class MessageTransformer {
  transform(messages: Message[], options: TransformOptions): GoogleGenAIRequest
}
```

**Algorithm:**
1. Extract system messages → consolidate
2. Convert roles: user→user, assistant→model
3. Convert content types
4. Wrap in Antigravity envelope

***

### Module 7: StreamingHandler

**Purpose:** Parse Google SSE responses

**Public API:**
```typescript
class StreamingHandler {
  async *handleStream(response: Response): AsyncIterable<AnthropicChunk>
}
```

***

### Module 8: ToolHardener

**Purpose:** Prevent tool hallucination (Mirrowel 4-layer pattern)

**Layers:**
1. Schema hardening (`additionalProperties: false`)
2. Signature injection
3. System prompt prepending
4. Namespace prefixing

***

### Module 9: ThinkingSanitizer

**Purpose:** Clean thinking blocks when toggling modes

***

### Module 10: AccountPoolManager

**Purpose:** Select best account based on tier and quota

**Algorithm:**
1. Filter active accounts with quota
2. Sort by tier priority, then quota remaining
3. Track usage for quota estimation

***

## 📋 CLI Commands

| Command | Purpose |
|---------|---------|
| `cc-mirror antigravity login` | OAuth authentication |
| `cc-mirror antigravity logout` | Remove account |
| `cc-mirror list-ag-sessions` | List AG sessions |
| `cc-mirror show-ag-session <id>` | Show session details |
| `cc-mirror send --continue-from-ag` | Send with AG context |
| `cc-mirror send --ag-session <id>` | Send with specific session |

***

## 🧪 Testing Strategy

**Coverage Target:** 90%

**Unit Tests:** Mock filesystem, OAuth, HTTP
**Integration Tests:** End-to-end flows with mocks
**Manual Tests:** Real OAuth, multi-platform

***

## 📊 Performance Targets

| Operation | Target |
|-----------|--------|
| Session discovery (100 files) | <50ms |
| Session parse (<1MB) | <100ms |
| Context injection | <20ms |
| End-to-end | <500ms (p90) |

***

## 📦 Dependencies

```json
{
  "dependencies": {
    "google-auth-library": "^9.0.0",
    "keytar": "^7.9.0",
    "express": "^4.18.0",
    "open": "^8.4.0",
    "fs-extra": "^11.2.0"
  }
}
```

***

## 📅 Implementation Schedule

- **Week 1-2:** State Bridge (Discovery, Parser, Injector)
- **Week 3:** OAuth (Manager, Storage, Tokens)
- **Week 4:** Protocol Translation (Transformer, Streaming)
- **Week 5:** Enhancements (ToolHardener, ThinkingSanitizer)
- **Week 6:** Polish & Launch

***

## ✅ APPROVALS

| Role | Signed | Notes |
|------|--------|-------|
| Tech Lead | Jan 7, 5:00 PM | Implementable in 6 weeks |
| Product Manager | Jan 7, 5:10 PM | UX meets PRD |
| System Architect | Jan 7, 5:15 PM | Follows ADD |
| Engineering Director | Jan 7, 5:20 PM | Greenlit |

***

**Status:** ✅ APPROVED - READY FOR IMPLEMENTATION

**END OF TDD v1.0**
