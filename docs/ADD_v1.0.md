# 📐 ARCHITECTURE DESIGN DOCUMENT (ADD)
**Project:** cc-mirror Antigravity State Bridge  
**Version:** 1.0 (Draft)  
**Date:** January 7, 2026, 8:45 AM SGT  
**Status:** DRAFT - Under Review  

***

## 🏛️ SYSTEM ARCHITECT INITIAL PROPOSAL

**Author:** System Architect  
**Date:** January 7, 2026, 9:00 AM  

### Executive Summary

This ADD defines the architecture for extending cc-mirror with Antigravity provider capabilities and state bridge functionality. The system enables:

1. **API Integration:** Claude Code CLI → Antigravity LLM backend
2. **State Bridge:** Read Antigravity IDE sessions → Inject context into Claude Code
3. **Production Features:** OAuth, multi-account, tool hardening, thinking sanitization

***

## 🎯 Architecture Principles

### 1. Separation of Concerns
```
┌──────────────────────────────────────┐
│  Presentation Layer (CLI)            │
│  - User commands                     │
│  - Output formatting                 │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Business Logic Layer                │
│  - State bridge logic                │
│  - Tool hardening                    │
│  - Thinking sanitization             │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Provider Abstraction Layer          │
│  - ProviderInterface                 │
│  - Message transformation            │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Integration Layer                   │
│  - OAuth management                  │
│  - HTTP client                       │
│  - API translation                   │
└──────────────┬───────────────────────┘
               │
               ▼
         External APIs
```

### 2. Fail-Safe by Default
- No AG sessions? Proceed without context
- Parse failure? Use generic parser
- OAuth failure? Clear error messages
- API down? Try fallback endpoints

### 3. Extensibility
- New AG format version? Add parser without breaking existing
- New Antigravity endpoint? Add to config array
- New provider? Implement ProviderInterface

### 4. Security First
- OAuth tokens encrypted at rest (AES-256-GCM)
- No secrets in logs
- File access validated (no path traversal)
- Input sanitization on all user data

***

## 🏗️ System Architecture

### High-Level Components

```typescript
┌─────────────────────────────────────────────────────────────┐
│                     cc-mirror Core                          │
│                   (Existing Codebase)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │           Provider Registry                       │     │
│  │  - z-ai                                           │     │
│  │  - minimax                                        │     │
│  │  - openrouter                                     │     │
│  │  - litellm                                        │     │
│  │  + antigravity (NEW)                              │     │
│  └─────────────────┬─────────────────────────────────┘     │
│                    │                                        │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              NEW: Antigravity Provider Module               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          State Bridge Subsystem                     │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  SessionDiscovery                             │  │   │
│  │  │  - Filesystem search                          │  │   │
│  │  │  - Multi-path support                         │  │   │
│  │  │  - Timestamp sorting                          │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  SessionParser                                │  │   │
│  │  │  - Format detection                           │  │   │
│  │  │  - Multi-version support                      │  │   │
│  │  │  - Generic fallback                           │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  ContextInjector                              │  │   │
│  │  │  - Message builder                            │  │   │
│  │  │  - Context formatting                         │  │   │
│  │  │  - Metadata attachment                        │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          API Integration Subsystem                  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  OAuthManager                                 │  │   │
│  │  │  - google-auth-library wrapper                │  │   │
│  │  │  - Token encryption/decryption                │  │   │
│  │  │  - Callback server (port 51121)               │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  TokenManager                                 │  │   │
│  │  │  - Multi-account storage                      │  │   │
│  │  │  - Background refresh (dual-queue)            │  │   │
│  │  │  - Expiry prediction                          │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  AccountPoolManager                           │  │   │
│  │  │  - Tier-based selection                       │  │   │
│  │  │  - Quota tracking                             │  │   │
│  │  │  - Health monitoring                          │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Protocol Translation Subsystem             │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  MessageTransformer                           │  │   │
│  │  │  - Anthropic → Google Gen AI                  │  │   │
│  │  │  - System message consolidation               │  │   │
│  │  │  - Tool call conversion                       │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  StreamingHandler                             │  │   │
│  │  │  - SSE parsing                                │  │   │
│  │  │  - Chunk transformation                       │  │   │
│  │  │  - Backpressure management                    │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  APIClient                                    │  │   │
│  │  │  - HTTP connection pool                       │  │   │
│  │  │  - Multi-endpoint fallback                    │  │   │
│  │  │  - Retry logic                                │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Enhancement Subsystem                      │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  ToolHardener                                 │  │   │
│  │  │  - Schema injection                           │  │   │
│  │  │  - Signature generation                       │  │   │
│  │  │  - 4-layer prevention                         │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  ThinkingSanitizer                            │  │   │
│  │  │  - Thought block detection                    │  │   │
│  │  │  - Context cleaning                           │  │   │
│  │  │  - Signature caching                          │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

***

## 📦 Component Specifications

### Component 1: State Bridge Subsystem

#### **1.1 SessionDiscovery**

```typescript
/**
 * Discovers Antigravity IDE session files on the user's filesystem.
 * Handles multiple OS-specific paths and custom overrides.
 */
export class SessionDiscovery {
  private searchPaths: string[];
  private cache: Map<string, AGSession[]>;
  private cacheExpiry: number = 60000; // 1 minute
  
  constructor(config?: SessionDiscoveryConfig) {
    this.searchPaths = this.buildSearchPaths(config);
  }
  
  /**
   * Returns all discovered sessions, sorted by most recent first.
   * Results are cached for 1 minute to avoid repeated filesystem scans.
   */
  async findSessions(): Promise<AGSession[]> {
    // Check cache first
    if (this.isCacheValid()) {
      return this.cache.get('sessions') || [];
    }
    
    const sessions: AGSession[] = [];
    
    for (const basePath of this.searchPaths) {
      // Skip if path doesn't exist
      if (!await fs.pathExists(basePath)) continue;
      
      // Find all JSON files
      const files = await fs.readdir(basePath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(basePath, file);
          const stats = await fs.stat(filePath);
          
          sessions.push({
            sessionId: this.extractSessionId(file),
            timestamp: stats.mtime,
            filePath,
            sizeBytes: stats.size
          });
        } catch (e) {
          logger.warn(`Failed to stat session file ${file}:`, e);
        }
      }
    }
    
    // Sort by most recent
    sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Update cache
    this.cache.set('sessions', sessions);
    this.cacheExpiry = Date.now() + 60000;
    
    return sessions;
  }
  
  private buildSearchPaths(config?: SessionDiscoveryConfig): string[] {
    const paths = [
      // Environment override (highest priority)
      process.env.AG_SESSION_DIR,
      
      // Standard locations
      path.join(os.homedir(), '.antigravity', 'sessions'),
      path.join(os.homedir(), '.config', 'antigravity', 'sessions'),
      
      // Platform-specific
      ...this.getPlatformPaths(),
      
      // Config override
      config?.customPath
    ];
    
    return paths.filter(Boolean) as string[];
  }
  
  private getPlatformPaths(): string[] {
    switch (process.platform) {
      case 'win32':
        return [
          path.join(process.env.APPDATA || '', 'Antigravity', 'sessions'),
          path.join(process.env.LOCALAPPDATA || '', 'Antigravity', 'sessions')
        ];
      case 'darwin':
        return [
          path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'sessions')
        ];
      default:
        return [];
    }
  }
}

interface SessionDiscoveryConfig {
  customPath?: string;
  cacheTimeout?: number;
}

interface AGSession {
  sessionId: string;
  timestamp: Date;
  filePath: string;
  sizeBytes: number;
}
```

**Design Decisions:**
- **Caching:** Filesystem scans are expensive; cache for 1 minute
- **Multi-path:** Support multiple OS conventions + user overrides
- **Graceful failure:** Missing paths don't throw errors
- **Metadata only:** Don't parse files yet (lazy loading)

***

#### **1.2 SessionParser**

```typescript
/**
 * Parses Antigravity session JSON files with resilience to format changes.
 * Supports multiple format versions and falls back to heuristic extraction.
 */
export class SessionParser {
  private formatDetectors: FormatDetector[] = [];
  
  constructor() {
    this.registerBuiltInFormats();
  }
  
  /**
   * Parses a session file and returns structured data.
   * Throws SessionParseError if file is completely unreadable.
   */
  async parse(filePath: string): Promise<ParsedSession> {
    // Read file
    const raw = await this.readSessionFile(filePath);
    
    // Try each known format
    for (const detector of this.formatDetectors) {
      if (detector.canParse(raw)) {
        logger.debug(`Detected AG format: ${detector.version}`);
        return await detector.parse(raw);
      }
    }
    
    // Fallback to generic extraction
    logger.warn('Unknown AG format, using generic parser');
    return this.parseGeneric(raw);
  }
  
  private async readSessionFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new SessionParseError(`Invalid JSON in ${filePath}`);
      }
      throw e;
    }
  }
  
  private registerBuiltInFormats() {
    // Format V1 (hypothetical - based on AG Beta)
    this.formatDetectors.push({
      version: 'v1',
      canParse: (obj) => 
        obj.hasOwnProperty('plan') && 
        obj.hasOwnProperty('initialPrompt') &&
        obj.hasOwnProperty('executionState'),
      parse: (obj) => this.parseV1(obj)
    });
    
    // Format V2 (future-proofing)
    this.formatDetectors.push({
      version: 'v2',
      canParse: (obj) => 
        obj.hasOwnProperty('agentPlan') && 
        obj.hasOwnProperty('sessionMetadata'),
      parse: (obj) => this.parseV2(obj)
    });
  }
  
  private parseV1(raw: any): ParsedSession {
    const steps = (raw.plan?.steps || []).map((step: any) => ({
      id: step.id || step.stepId,
      action: step.description || step.action || step.title,
      status: this.normalizeStatus(step.status),
      artifacts: step.files || step.artifacts || [],
      output: step.result || step.output,
      timestamp: step.timestamp ? new Date(step.timestamp) : undefined
    }));
    
    const currentIdx = raw.executionState?.currentStep || 0;
    
    return {
      sessionId: raw.sessionId || 'unknown',
      goal: raw.initialPrompt || raw.goal || 'Unknown goal',
      planSteps: steps,
      currentStep: currentIdx,
      completedSteps: steps.filter(s => s.status === 'completed'),
      pendingSteps: steps.filter(s => s.status === 'pending' || s.status === 'executing'),
      filesModified: this.extractFilesFromSteps(steps),
      variables: raw.executionState?.variables || raw.variables || {},
      terminalHistory: raw.terminalHistory || [],
      errors: raw.errors || []
    };
  }
  
  private parseGeneric(raw: any): ParsedSession {
    // Use heuristics when format is unknown
    return {
      sessionId: this.findInObject(raw, ['sessionId', 'id', 'session_id']) || 'unknown',
      goal: this.findInObject(raw, ['goal', 'task', 'prompt', 'initialPrompt', 'request']) || 'Unknown goal',
      planSteps: this.extractStepsGeneric(raw),
      currentStep: 0,
      completedSteps: [],
      pendingSteps: [],
      filesModified: this.extractFilesGeneric(raw),
      variables: this.findInObject(raw, ['variables', 'state', 'context']) || {},
      terminalHistory: [],
      errors: []
    };
  }
  
  /**
   * Recursively searches object for likely values based on key names.
   */
  private findInObject(obj: any, keys: string[]): any {
    for (const key of keys) {
      if (obj.hasOwnProperty(key)) {
        return obj[key];
      }
    }
    
    // Search nested objects
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.findInObject(value, keys);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  private normalizeStatus(status: string): StepStatus {
    const normalized = status.toLowerCase();
    
    if (['complete', 'completed', 'done', 'success'].includes(normalized)) {
      return 'completed';
    }
    if (['running', 'executing', 'in_progress', 'active'].includes(normalized)) {
      return 'executing';
    }
    if (['failed', 'error', 'cancelled'].includes(normalized)) {
      return 'failed';
    }
    return 'pending';
  }
}

interface FormatDetector {
  version: string;
  canParse: (obj: any) => boolean;
  parse: (obj: any) => ParsedSession;
}

type StepStatus = 'pending' | 'executing' | 'completed' | 'failed';
```

**Design Decisions:**
- **Format registry:** Easy to add new parsers without modifying core logic
- **Heuristic fallback:** Even unknown formats can be partially extracted
- **Lazy field access:** Handles missing/renamed fields gracefully
- **Extensibility:** New formats added via `registerFormat()` method

***

## 💬 TECH LEAD FIRST REVIEW

**Date:** January 7, 2026, 10:00 AM  
**Reviewer:** Tech Lead  

### Concern 1: SessionParser Complexity

**Issue:** The generic parser is doing recursive object searches. For large session files (100+ MB in production), this could be **O(n²)** complexity.

**Example Risk:**
```typescript
// Session file with deeply nested structure
{
  "metadata": {
    "context": {
      "variables": {
        "nested": {
          "deep": {
            "goal": "Build API" // findInObject recurses 5 levels
          }
        }
      }
    }
  }
}
```

**Proposed Solution:**
```typescript
private findInObject(obj: any, keys: string[], maxDepth: number = 3): any {
  return this.findInObjectRecursive(obj, keys, 0, maxDepth);
}

private findInObjectRecursive(obj: any, keys: string[], depth: number, maxDepth: number): any {
  if (depth > maxDepth) return null; // Limit recursion depth
  
  // ... rest of logic
}
```

**System Architect Response?**

***

## 🏛️ SYSTEM ARCHITECT RESPONSE 1

**Date:** January 7, 2026, 10:15 AM  

### Response to Concern 1: Accepted with Modifications

**Agreement:** Yes, unbounded recursion is a risk. Let's add depth limits AND size limits.

**Enhanced Solution:**
```typescript
export class SessionParser {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_RECURSION_DEPTH = 5;
  
  async parse(filePath: string): Promise<ParsedSession> {
    // Check file size before reading
    const stats = await fs.stat(filePath);
    
    if (stats.size > this.MAX_FILE_SIZE) {
      logger.warn(`Session file too large (${stats.size} bytes), using streaming parser`);
      return this.parseStream(filePath);
    }
    
    const raw = await this.readSessionFile(filePath);
    
    // ... rest of parsing logic
  }
  
  private async parseStream(filePath: string): Promise<ParsedSession> {
    // For large files, stream parse only essential fields
    const stream = fs.createReadStream(filePath);
    const parser = JSONStream.parse(['goal', 'plan', 'executionState']);
    
    return new Promise((resolve, reject) => {
      const essentialData: any = {};
      
      stream
        .pipe(parser)
        .on('data', (data) => {
          Object.assign(essentialData, data);
        })
        .on('end', () => {
          resolve(this.parseV1(essentialData)); // Assume v1 format
        })
        .on('error', reject);
    });
  }
}
```

**Rationale:**
- Files <10MB: Fast in-memory parsing
- Files >10MB: Stream parsing (only extract essential fields)
- Recursion depth: Hard limit of 5 levels

**Tech Lead, does this address your concern?**

***

## 💻 TECH LEAD RESPONSE 1

**Date:** January 7, 2026, 10:30 AM  

### ✅ Accepted with One Addition

The streaming parser is good, but I'd add a **timeout mechanism** to prevent hanging on malformed files.

```typescript
private async parseStream(filePath: string): Promise<ParsedSession> {
  return Promise.race([
    this.parseStreamInternal(filePath),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Stream parse timeout')), 5000)
    )
  ]);
}
```

**Also raising new concern...**

### Concern 2: Context Injection Message Size

**Issue:** The injected context message could be **HUGE** if AG's plan has 50+ steps with long outputs.

**Example:**
```typescript
// AG plan with 50 steps
session.planSteps = [
  { action: "Step 1", output: "...5000 chars..." },
  { action: "Step 2", output: "...5000 chars..." },
  // ... x50 = 250KB of text
];

const contextMsg = injector.buildContextMessage(session);
// contextMsg could be 300KB+
```

**Risk:** Anthropic API has token limits (200K for Claude 3.5 Sonnet). A 300KB context message = ~75K tokens, eating into user's quota.

**Question:** Should we summarize/truncate the context?

***

## 🏛️ SYSTEM ARCHITECT RESPONSE 2

**Date:** January 7, 2026, 10:45 AM  

### Response to Concern 2: Introduce Smart Truncation

**Agreement:** Yes, raw context injection could overwhelm token budgets. Let's add intelligent summarization.

**Updated ContextInjector Design:**

```typescript
export class ContextInjector {
  private readonly MAX_CONTEXT_TOKENS = 10000; // ~40KB of text
  private readonly TOKENS_PER_CHAR = 0.25; // Rough estimate
  
  buildContextMessage(session: ParsedSession, options?: ContextOptions): string {
    const sections: string[] = [];
    let estimatedTokens = 0;
    
    // Always include (core context)
    const header = this.buildHeader(session);
    sections.push(header);
    estimatedTokens += this.estimateTokens(header);
    
    const goal = this.buildGoalSection(session);
    sections.push(goal);
    estimatedTokens += this.estimateTokens(goal);
    
    // Conditionally include based on token budget
    const progress = this.buildProgressSection(session);
    if (estimatedTokens + this.estimateTokens(progress) < this.MAX_CONTEXT_TOKENS) {
      sections.push(progress);
      estimatedTokens += this.estimateTokens(progress);
    }
    
    // Completed steps (truncate if needed)
    const completed = this.buildCompletedSteps(session, this.MAX_CONTEXT_TOKENS - estimatedTokens);
    sections.push(completed);
    estimatedTokens += this.estimateTokens(completed);
    
    // Pending steps (summarize, no detailed output)
    const pending = this.buildPendingSteps(session, true /* summarize */);
    sections.push(pending);
    
    // Files (always include, usually small)
    sections.push(this.buildFilesSection(session));
    
    return sections.join('\n\n');
  }
  
  private buildCompletedSteps(session: ParsedSession, remainingTokens: number): string {
    const lines: string[] = ['## Completed Steps'];
    let tokens = 0;
    
    for (let i = 0; i < session.completedSteps.length; i++) {
      const step = session.completedSteps[i];
      
      // Basic step info (always include)
      const stepLine = `${i+1}. ✅ ${step.action}`;
      lines.push(stepLine);
      tokens += this.estimateTokens(stepLine);
      
      // Artifacts (include if space permits)
      if (step.artifacts?.length) {
        const artifactsLine = `   Files: ${step.artifacts.join(', ')}`;
        if (tokens + this.estimateTokens(artifactsLine) < remainingTokens) {
          lines.push(artifactsLine);
          tokens += this.estimateTokens(artifactsLine);
        }
      }
      
      // Output (SKIP - usually verbose)
      // User can see output in AG IDE if needed
      
      if (tokens > remainingTokens) {
        lines.push(`... (${session.completedSteps.length - i} more steps omitted)`);
        break;
      }
    }
    
    return lines.join('\n');
  }
  
  private buildPendingSteps(session: ParsedSession, summarize: boolean): string {
    if (summarize && session.pendingSteps.length > 10) {
      return `
## Pending Steps (${session.pendingSteps.length} remaining)
🔄 Next: ${session.pendingSteps[0]?.action}
⧗ After that: ${session.pendingSteps.slice(1, 3).map(s => s.action).join(', ')}
... and ${session.pendingSteps.length - 3} more steps
`;
    }
    
    // Standard format for reasonable lists
    return `
## Pending Steps
${session.pendingSteps.map((s, i) => 
  `${i+1}. ${i === 0 ? '🔄' : '⧗'} ${s.action}`
).join('\n')}
`;
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.TOKENS_PER_CHAR);
  }
}
```

**Key Features:**
- **Token budget:** Hard limit of 10K tokens (~40KB text)
- **Priority truncation:** Goal + files always included, output skipped
- **Smart summarization:** Pending steps summarized if >10 items
- **Graceful overflow:** "X more steps omitted" message

**Tech Lead, does this solve the token bloat issue?**

***

## 💼 ENGINEERING DIRECTOR INTERJECTS

**Date:** January 7, 2026, 11:00 AM  
**Priority:** CRITICAL DESIGN DECISION  

### Director Concern: Over-Engineering Risk

**Observation:** We're adding streaming parsers, token estimators, smart truncation... this is getting complex fast.

**Reminder of Timeline:**
- Target: 6 weeks
- Current trajectory: Designing for "enterprise scale" on week 1
- Risk: Over-engineering delays MVP

### Director Question to Architect & Tech Lead

**Question 1:** What % of users will actually hit these edge cases?
- Session files >10MB?
- Context >10K tokens?
- 50+ plan steps?

**Question 2:** Can we ship MVP without these features, add them later based on real usage data?

**Proposed Simplification:**
```typescript
// MVP version (simple)
async parse(filePath: string): Promise<ParsedSession> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return this.parseV1(raw); // Assume v1, handle errors gracefully
}

buildContextMessage(session: ParsedSession): string {
  // Just dump everything, no truncation
  // If it's too big, user will see API error and we fix in v1.1
  return this.simpleTemplate(session);
}
```

**Trade-off:**
- Ship in 4 weeks (not 6)
- Handle 95% of users perfectly
- Learn from the 5% edge cases before optimizing

**Architect & Tech Lead: Respond with recommendation**

***

## 🏛️ SYSTEM ARCHITECT RESPONSE 3

**Date:** January 7, 2026, 11:15 AM  

### Architect's Position: Partial Agreement

**Concession:** You're right that we're optimizing for edge cases we haven't validated.

**Data-Driven Answer:**
Let me estimate usage distribution based on similar IDE tools:

| Session Size | Probability | Impact if Unhandled |
|--------------|-------------|---------------------|
| <1MB | 85% | None (works perfectly) |
| 1-10MB | 12% | Slow parse (2-3s) – acceptable |
| >10MB | 3% | OOM crash – **CRITICAL** |

| Context Size | Probability | Impact if Unhandled |
|--------------|-------------|---------------------|
| <5K tokens | 80% | None |
| 5-10K tokens | 15% | None (within limits) |
| >10K tokens | 5% | API rejection – **HIGH** |

**Recommendation: HYBRID APPROACH**

**Ship in MVP (Week 1-4):**
```typescript
async parse(filePath: string): Promise<ParsedSession> {
  // Simple size check (prevents crashes)
  const stats = await fs.stat(filePath);
  if (stats.size > 50 * 1024 * 1024) { // 50MB hard limit
    throw new Error('Session file too large (>50MB)');
  }
  
  // Standard parse (no streaming)
  const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  return this.parseV1(raw);
}

buildContextMessage(session: ParsedSession): string {
  const msg = this.simpleTemplate(session);
  
  // Simple length check (prevents API rejection)
  if (msg.length > 50000) { // ~12.5K tokens
    logger.warn('Context is large, truncating...');
    return this.truncateMessage(msg, 50000);
  }
  
  return msg;
}

private truncateMessage(msg: string, maxLen: number): string {
  // Dumb truncation: just cut at limit and add ellipsis
  return msg.slice(0, maxLen) + '\n\n... (context truncated due to size)';
}
```

**Defer to v1.1 (Week 7+):**
- Streaming parser (for >10MB files)
- Smart token estimation
- Intelligent summarization

**Rationale:**
- Crashes on >50MB files: Acceptable (edge case, clear error)
- Token bloat: Handled with simple truncation (not optimal, but works)
- Ship in 4 weeks with 95% coverage

**Director, does this balance speed vs quality?**

***

## 💼 ENGINEERING DIRECTOR RESPONSE

**Date:** January 7, 2026, 11:30 AM  

### ✅ APPROVED - Hybrid Approach

**Decision:** Go with Architect's hybrid proposal.

**Rationale:**
- Prevents critical failures (crashes, API rejections)
- Keeps complexity low for MVP
- Leaves optimization for data-driven v1.1

**However, I'm adding one requirement...**

### Director Requirement: Telemetry for v1.1 Planning

Add basic instrumentation to understand real-world usage:

```typescript
// Add to SessionParser
async parse(filePath: string): Promise<ParsedSession> {
  const start = Date.now();
  const stats = await fs.stat(filePath);
  
  // ... parsing logic ...
  
  const duration = Date.now() - start;
  
  // Anonymous telemetry (opt-in during cc-mirror setup)
  telemetry.record('ag_session_parse', {
    file_size_kb: Math.round(stats.size / 1024),
    parse_time_ms: duration,
    format_version: detectedVersion,
    steps_count: parsed.planSteps.length,
    files_count: parsed.filesModified.length
  });
  
  return parsed;
}

// Add to ContextInjector
buildContextMessage(session: ParsedSession): string {
  const msg = this.simpleTemplate(session);
  
  telemetry.record('ag_context_injection', {
    context_size_kb: Math.round(msg.length / 1024),
    steps_completed: session.completedSteps.length,
    steps_pending: session.pendingSteps.length,
    was_truncated: msg.length > 50000
  });
  
  return msg;
}
```

**Use this data to prioritize v1.1 features:**
- If 20% of parses are >10MB → Build streaming parser
- If 15% of contexts truncated → Build smart summarization
- If <1% hit limits → Don't optimize further

**Tech Lead, can you add this instrumentation to your implementation tickets?**

***

## 💻 TECH LEAD RESPONSE 2

**Date:** January 7, 2026, 11:45 AM  

### ✅ Accepted - Telemetry Added to Scope

Will add opt-in telemetry to Sprint 3 (week 5).

**But now I have a NEW concern from the Protocol Translation subsystem...**

### Concern 3: OAuth Token Storage Security

**Issue:** The PRD says "AES-256-GCM encryption" for tokens, but the ADD doesn't specify key management.

**Risk:** Where does the encryption key come from?
- Hardcoded key? ❌ Insecure (anyone can decrypt)
- User-provided key? ❌ Poor UX (where do they store it?)
- Derived from machine ID? 🟡 Better, but predictable
- OS keychain? ✅ Best, but complex to implement

**Example Attack:**
```bash
# If key is hardcoded or predictable
attacker_script:
  1. Find ~/.cc-mirror/antigravity-tokens.enc
  2. Use hardcoded key to decrypt
  3. Steal OAuth tokens
  4. Use tokens on attacker's machine
```

**Current ADD has no specification for this. Architect?**

***

## 🏛️ SYSTEM ARCHITECT RESPONSE 4

**Date:** January 7, 2026, 12:00 PM  

### Response to Concern 3: OS Keychain Integration

**Agreement:** You're absolutely right. Token security is critical. Let's use OS-native keychains.

**Updated OAuthManager Design:**

```typescript
import * as keytar from 'keytar';
import * as crypto from 'crypto';

export class OAuthManager {
  private readonly SERVICE_NAME = 'cc-mirror-antigravity';
  private readonly KEY_NAME = 'encryption-key';
  
  async storeTokens(email: string, tokens: Credentials): Promise<void> {
    // Get or generate encryption key (stored in OS keychain)
    const encryptionKey = await this.getEncryptionKey();
    
    // Encrypt tokens
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Store encrypted tokens to filesystem
    const tokenFile = path.join(this.tokenDir, `${email}.enc`);
    await fs.writeJSON(tokenFile, {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }
  
  async retrieveTokens(email: string): Promise<Credentials> {
    const encryptionKey = await this.getEncryptionKey();
    const tokenFile = path.join(this.tokenDir, `${email}.enc`);
    
    const { iv, authTag, data } = await fs.readJSON(tokenFile);
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
  
  private async getEncryptionKey(): Promise<Buffer> {
    // Try to retrieve from OS keychain
    let key = await keytar.getPassword(this.SERVICE_NAME, this.KEY_NAME);
    
    if (!key) {
      // Generate new key
      key = crypto.randomBytes(32).toString('hex');
      
      // Store in OS keychain
      await keytar.setPassword(this.SERVICE_NAME, this.KEY_NAME, key);
      
      logger.info('Generated new encryption key (stored in OS keychain)');
    }
    
    return Buffer.from(key, 'hex');
  }
}
```

**How this works:**
1. **First run:** Generate random 256-bit key → Store in OS keychain
2. **Subsequent runs:** Retrieve key from keychain → Use for encryption/decryption
3. **Filesystem:** Only encrypted tokens (`.enc` files), no keys
4. **Portability:** Each machine has unique key (tokens can't be stolen and used elsewhere)

**OS Keychain Details:**
- **macOS:** Uses Keychain Access (same as Safari, Chrome)
- **Windows:** Uses Credential Manager (same as Edge)
- **Linux:** Uses `libsecret` (GNOME Keyring or KDE Wallet)

**Dependency:** `keytar` library (maintained by Electron team, 1M+ weekly downloads)

**Tech Lead, does this address the security concern?**

***

## 💻 TECH LEAD RESPONSE 3

**Date:** January 7, 2026, 12:15 PM  

### ✅ Approved - But Raising Edge Case

The keychain approach is solid, but **what about headless servers?** (CI/CD, Docker containers, SSH-only VPS)

**Scenario:**
```bash
# User deploys on Ubuntu server (no GUI, no GNOME Keyring)
$ cc-mirror antigravity login
Error: No keychain service available on this system
```

**Proposed Fallback:**
```typescript
private async getEncryptionKey(): Promise<Buffer> {
  try {
    // Try OS keychain first
    return await this.getFromKeychain();
  } catch (e) {
    logger.warn('OS keychain unavailable, using machine-id fallback');
    return this.getFromMachineId();
  }
}

private async getFromMachineId(): Promise<Buffer> {
  const machineId = await getMachineId(); // Cross-platform machine identifier
  const salt = 'cc-mirror-antigravity-v1'; // Static salt
  
  // Derive key using PBKDF2
  return crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
}
```

**Security Trade-off:**
- **With keychain:** Key stored separately, can't steal tokens
- **Without keychain (fallback):** Key is deterministic, tokens portable (less secure, but **functional**)

**Accept this degraded security for headless deployments?**

***

## 💼 ENGINEERING DIRECTOR FINAL DECISION

**Date:** January 7, 2026, 12:30 PM  

### ✅ APPROVED with Documentation Caveat

Accept the machine-id fallback, BUT document the security implications clearly.

**Required User Documentation:**

```markdown
# Token Security

## Desktop/GUI Systems (Recommended)
cc-mirror stores encryption keys in your OS keychain:
- **macOS:** Keychain Access
- **Windows:** Credential Manager  
- **Linux (GUI):** GNOME Keyring / KDE Wallet

Tokens are encrypted at rest and protected by your OS login password.

## Headless Servers (Reduced Security)
On systems without a keychain service (Docker, SSH-only servers), 
cc-mirror derives encryption keys from your machine ID.

⚠️ **Security Warning:**
- Tokens are tied to the machine hardware
- If an attacker gains filesystem access, they can decrypt tokens
- Only use headless mode on trusted infrastructure

Recommended: Use service accounts with minimal permissions.
```

**Acceptable risk for v1.0?** Yes. Most users are on desktop. Server users understand trade-offs.

***

**Let me now finalize the ADD with all agreed decisions...**

***

## 📋 FINALIZED ARCHITECTURE DESIGN DOCUMENT

### Component Specifications (Updated)

#### **OAuth Token Management (Final)**

```typescript
export class SecureTokenStorage {
  private keyStore: KeyStore;
  
  constructor() {
    this.keyStore = new KeyStore({
      serviceName: 'cc-mirror-antigravity',
      fallbackToMachineId: true // Enable headless support
    });
  }
  
  async encrypt(data: any): Promise<EncryptedData> {
    const key = await this.keyStore.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      data: encrypted,
      algorithm: 'aes-256-gcm'
    };
  }
  
  async decrypt(encrypted: EncryptedData): Promise<any> {
    const key = await this.keyStore.getKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

class KeyStore {
  async getKey(): Promise<Buffer> {
    // Try keychain first
    if (await this.isKeychainAvailable()) {
      return await this.getFromKeychain();
    }
    
    // Fallback to machine-id (headless)
    logger.warn('Using machine-id key derivation (reduced security)');
    return await this.getFromMachineId();
  }
  
  private async isKeychainAvailable(): Promise<boolean> {
    try {
      await keytar.findCredentials(this.serviceName);
      return true;
    } catch (e) {
      return false;
    }
  }
}
```

***

### Data Flow Diagrams

#### **Flow 1: User Initiates OAuth**

```
┌─────────┐
│  User   │
└────┬────┘
     │ $ cc-mirror antigravity login
     ▼
┌─────────────────────────────┐
│  CLI Command Handler        │
└────┬────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  OAuthManager.initiate()    │
│  - Start callback server    │
│  - Generate auth URL        │
└────┬────────────────────────┘
     │
     ├─→ http://localhost:51121 (callback server running)
     │
     └─→ https://accounts.google.com/o/oauth2/v2/auth
              ?client_id=...
              &redirect_uri=http://localhost:51121/callback
              &scope=https://www.googleapis.com/auth/cloud-platform
              
         ┌──────────────────┐
         │  User's Browser  │
         │  (Opens auto)    │
         └────┬─────────────┘
              │ User approves
              ▼
         Google redirects to:
         http://localhost:51121/callback?code=4/xxxxx
              │
              ▼
┌─────────────────────────────┐
│  OAuthManager.handleCallback│
│  - Exchange code for tokens │
│  - Encrypt tokens           │
│  - Store to filesystem      │
└────┬────────────────────────┘
     │
     ▼
~/.cc-mirror/antigravity-tokens/
  └─ user@gmail.com.enc
       {
         "iv": "...",
         "authTag": "...",
         "data": "encrypted_tokens_here"
       }
```

***

#### **Flow 2: User Sends Message with AG Context**

```
┌─────────┐
│  User   │
└────┬────┘
     │ $ cc-mirror send --continue-from-ag "Add tests"
     ▼
┌────────────────────────────────────────────┐
│  CLI: sendCommand()                        │
│  - Parse flags (--continue-from-ag)        │
└────┬───────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  SessionDiscovery.getLatestSession()       │
│  - Scan ~/.antigravity/sessions/*.json     │
│  - Sort by timestamp                       │
│  - Return most recent                      │
└────┬───────────────────────────────────────┘
     │ session-abc123.json
     ▼
┌────────────────────────────────────────────┐
│  SessionParser.parse(session-abc123.json)  │
│  - Read file                               │
│  - Detect format (v1/v2/generic)           │
│  - Extract goal, steps, files              │
└────┬───────────────────────────────────────┘
     │ ParsedSession object
     ▼
┌────────────────────────────────────────────┐
│  ContextInjector.injectContext()           │
│  - Build context message                   │
│  - Prepend to user's message array         │
└────┬───────────────────────────────────────┘
     │ Enhanced messages
     ▼
┌────────────────────────────────────────────┐
│  AntigravityProvider.sendMessage()         │
│  - Apply tool hardening                    │
│  - Apply thinking sanitization             │
│  - Select account from pool                │
│  - Get OAuth token                         │
│  - Transform Anthropic → Google format     │
└────┬───────────────────────────────────────┘
     │ HTTPS POST
     ▼
https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal
     │
     ▼
┌────────────────────────────────────────────┐
│  Google Antigravity API                    │
│  - Process request                         │
│  - Return streaming response (SSE)         │
└────┬───────────────────────────────────────┘
     │ Stream chunks
     ▼
┌────────────────────────────────────────────┐
│  StreamingHandler.handleStream()           │
│  - Parse SSE format                        │
│  - Convert Google → Anthropic chunks       │
└────┬───────────────────────────────────────┘
     │ Anthropic format chunks
     ▼
┌─────────┐
│  User   │ (sees streaming response)
└─────────┘
```

***

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│              User's Machine (Linux/macOS/Windows)       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  VS Code (or terminal)                          │   │
│  │  ┌────────────────────────────────────────┐     │   │
│  │  │  Claude Code Extension                 │     │   │
│  │  │  - Uses cc-mirror as backend           │     │   │
│  │  └────────────┬───────────────────────────┘     │   │
│  └───────────────┼─────────────────────────────────┘   │
│                  │                                      │
│  ┌───────────────▼─────────────────────────────────┐   │
│  │  cc-mirror (Node.js Process)                    │   │
│  │  - Antigravity provider                         │   │
│  │  - State bridge                                 │   │
│  │  - Other providers (z-ai, minimax, etc.)        │   │
│  └───────────────┬─────────────────────────────────┘   │
│                  │                                      │
│  ┌───────────────▼─────────────────────────────────┐   │
│  │  Filesystem                                     │   │
│  │  ~/.cc-mirror/                                  │   │
│  │    ├─ config.json                               │   │
│  │    └─ antigravity-tokens/                       │   │
│  │         └─ user@gmail.com.enc                   │   │
│  │                                                  │   │
│  │  ~/.antigravity/sessions/                       │   │
│  │    ├─ session-abc123.json (AG IDE writes)       │   │
│  │    └─ session-def456.json                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  OS Keychain                                     │   │
│  │  - Keychain Access (macOS)                       │   │
│  │  - Credential Manager (Windows)                  │   │
│  │  - libsecret (Linux)                             │   │
│  │                                                  │   │
│  │  Stores: cc-mirror-antigravity/encryption-key    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Google Cloud Infrastructure                │
├─────────────────────────────────────────────────────────┤
│  https://daily-cloudcode-pa.sandbox.googleapis.com      │
│  https://cloudcode-pa.googleapis.com (fallback)         │
│                                                         │
│  - Antigravity LLM backend                              │
│  - OAuth validation                                     │
│  - Quota enforcement                                    │
└─────────────────────────────────────────────────────────┘
```

***

### Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Runtime** | Node.js 18+ | Existing cc-mirror platform, mature ecosystem |
| **Language** | TypeScript 5.x | Type safety, better maintainability |
| **OAuth** | google-auth-library 9.x | Official Google library, production-tested |
| **Encryption** | Node.js crypto (built-in) | AES-256-GCM, no external deps |
| **Keychain** | keytar 7.x | Cross-platform, Electron-team maintained |
| **HTTP Client** | node-fetch 3.x | Standard fetch API, streaming support |
| **File I/O** | fs-extra 11.x | Promise-based, cross-platform |
| **CLI Framework** | commander.js 11.x | Existing cc-mirror dependency |
| **Testing** | Jest 29.x | Standard for Node.js projects |
| **Linting** | ESLint + Prettier | Code quality, consistency |

***

### Security Considerations

#### **Threat Model**

| Threat | Mitigation | Residual Risk |
|--------|-----------|---------------|
| **OAuth Token Theft** | AES-256-GCM encryption + OS keychain | Low (requires OS login + filesystem access) |
| **Man-in-Middle (OAuth)** | HTTPS only, redirect validation | Very Low (TLS 1.3) |
| **Session File Tampering** | Read-only access, validation on parse | Low (worst case: parse fails, no context) |
| **Path Traversal** | Input validation, canonical path resolution | Very Low |
| **Memory Dump** | Tokens cleared after use, no swap to disk | Low (requires root/admin access) |
| **Headless Key Derivation** | Machine-id based PBKDF2 | Medium (documented trade-off) |

#### **Compliance**

- **GDPR:** No PII collected (telemetry is anonymous)
- **OAuth 2.0:** Follows Google's security guidelines
- **Token Storage:** Matches industry standard (VS Code, GitHub CLI)

***

### Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Session Discovery** | <50ms | Benchmark with 100 session files |
| **Session Parse** | <100ms (<1MB files) | Jest performance tests |
| **Context Injection** | <20ms | In-memory operation |
| **OAuth Token Retrieval** | <30ms (cached) | Keychain access benchmark |
| **API Translation** | <15ms | Transformation unit tests |
| **End-to-End Latency** | <500ms (p90) | Integration tests with mock API |

***

### Error Handling Strategy

```typescript
// Error hierarchy
class StateBridgeError extends Error {
  code: string;
  recoverable: boolean;
}

class SessionNotFoundError extends StateBridgeError {
  code = 'SESSION_NOT_FOUND';
  recoverable = true; // Can proceed without context
}

class SessionParseError extends StateBridgeError {
  code = 'SESSION_PARSE_FAILED';
  recoverable = true; // Fall back to generic parser or skip context
}

class OAuthError extends StateBridgeError {
  code = 'OAUTH_FAILED';
  recoverable = false; // User must re-authenticate
}

// Error handling middleware
async function handleStateBridgeError(error: StateBridgeError, context: any) {
  if (error.recoverable) {
    logger.warn(error.message);
    telemetry.recordError(error, { recovered: true });
    return context.proceedWithoutAGContext();
  } else {
    logger.error(error.message);
    telemetry.recordError(error, { recovered: false });
    throw error; // Propagate to user
  }
}
```

***

## ✅ FINAL APPROVALS

### System Architect
**Approved:** January 7, 2026, 12:45 PM  
**Signature:** System Architect  
**Notes:** Architecture balances pragmatism (MVP focus) with extensibility (v1.1 ready)

### Tech Lead
**Approved:** January 7, 2026, 12:50 PM  
**Signature:** Tech Lead  
**Notes:** All security concerns addressed. Implementation roadmap is feasible in 6 weeks.

### Engineering Director
**Approved:** January 7, 2026, 1:00 PM  
**Signature:** Engineering Director  
**Notes:** Risk profile acceptable. Telemetry will inform v1.1 priorities. Budget allocated.

***

## 📅 Implementation Phases (Summary)

### Phase 1: State Bridge (Weeks 1-2)
- SessionDiscovery (file scanning, caching)
- SessionParser (v1 format + generic fallback)
- ContextInjector (simple template, basic truncation)
- CLI commands (list-ag-sessions, show-ag-session)

### Phase 2: API Integration (Weeks 3-4)
- OAuthManager (google-auth-library, keychain storage)
- TokenManager (refresh queue, expiry tracking)
- AccountPoolManager (tier selection, quota tracking)
- MessageTransformer (Anthropic → Google Gen AI)
- StreamingHandler (SSE parsing)
- APIClient (HTTP pool, fallback endpoints)

### Phase 3: Enhancements (Week 5)
- ToolHardener (4-layer prevention from Mirrowel)
- ThinkingSanitizer (context cleaning)
- Error handling (graceful degradation)
- Telemetry (opt-in instrumentation)

### Phase 4: Testing & Launch (Week 6)
- Unit tests (90% coverage target)
- Integration tests (end-to-end flows)
- Performance benchmarks
- Documentation (user guide, API reference)
- Beta release

***

## 🎬 PROJECT STATUS

**Architecture Design:** ✅ APPROVED  
**Next Step:** Tech Lead to create detailed implementation tickets  
**Kickoff:** January 8, 2026 (Sprint 1)  
**Target Delivery:** February 18, 2026 (6 weeks)  

***

**END OF ADD v1.0**
