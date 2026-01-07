# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD) v2.0
**Project:** cc-mirror Antigravity Provider with State Bridge  
**Version:** 2.0 (State-Aware Integration)  
**Date:** January 7, 2026  
**Status:** APPROVED - Path 2 Implementation  
**Owner:** Product Team + Engineering  

***

## 🎯 Executive Summary

Build an Antigravity provider for cc-mirror that enables Claude Code CLI to:
1. **Use Antigravity's LLM backend** (API-level integration)
2. **Read Antigravity IDE's session state** (one-way state bridge)
3. **Inject AG context automatically** into Claude Code conversations

This allows users to start work in Antigravity IDE's native agent, then seamlessly continue in Claude Code CLI without re-explaining context.

**Timeline:** 6 weeks (Sprint 1-3)  
**Effort:** 2 backend engineers  
**Risk Level:** Medium (state format reverse-engineering)  

***

## 📐 Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  USER WORKFLOW                          │
├─────────────────────────────────────────────────────────┤
│  Step 1: Work in Antigravity IDE                        │
│    $ ag-agent "Build REST API with authentication"      │
│                                                         │
│  Step 2: Switch to Claude Code CLI                      │
│    $ cc-mirror send --continue-from-ag \                │
│        "Add rate limiting to the API"                   │
│                                                         │
│  Result: Claude Code sees AG's plan + progress          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│            LAYER 1: State Bridge (NEW)                  │
│                cc-mirror State Reader                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Antigravity Session Parser                      │   │
│  │  - Reads ~/.antigravity/sessions/*.json          │   │
│  │  - Parses plan, execution state, context         │   │
│  │  - Converts to natural language summary          │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                   │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │  Context Injection Engine                        │   │
│  │  - Builds system message from AG state           │   │
│  │  - Includes: goal, completed steps, pending      │   │
│  │  - Adds file modifications, variables            │   │
│  └──────────────────┬───────────────────────────────┘   │
└────────────────────┼────────────────────────────────────┘
                     │ Enhanced messages
                     ▼
┌─────────────────────────────────────────────────────────┐
│         LAYER 2: Protocol Translation                   │
│              cc-mirror Antigravity Provider             │
│  (Same as original TDD - OAuth, API translation, etc.)  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              Google Antigravity API
```

***

## 🎯 User Stories (Updated)

### Core Stories (From Original PRD)

**Story 1:** As a developer, I want to use Claude Code CLI with Antigravity's quota  
**Story 2:** As a user with multiple Google accounts, I want automatic rotation  
**Story 3:** As a Claude Code user, I want tool calling to work reliably  

### NEW Stories (State Bridge)

**Story 4:** As a user working in Antigravity IDE, I want Claude Code to understand what I've already accomplished  
**Acceptance Criteria:**
- When I run `cc-mirror send --continue-from-ag "next task"`, Claude Code receives:
  - The original goal from AG session
  - List of completed steps
  - List of pending steps
  - Files modified by AG
  - Current execution state

**Story 5:** As a user, I want to quickly resume AG work without manual copy-paste  
**Acceptance Criteria:**
- `cc-mirror send --continue-from-ag` auto-detects latest AG session
- Session summary appears in Claude Code's context
- No manual file editing required

**Story 6:** As a user, I want to choose which AG session to continue  
**Acceptance Criteria:**
- `cc-mirror list-ag-sessions` shows recent sessions
- `cc-mirror send --ag-session <id>` continues specific session
- Error message if session file doesn't exist

***

## 🏗️ Technical Requirements

### Feature 1: Antigravity Session Discovery

**Specification:**
```typescript
interface SessionDiscovery {
  // Find AG sessions on user's filesystem
  findSessions(): Promise<AGSession[]>;
  
  // Get most recent session (by timestamp)
  getLatestSession(): Promise<AGSession | null>;
  
  // Get specific session by ID
  getSessionById(id: string): Promise<AGSession | null>;
}

interface AGSession {
  sessionId: string;           // From filename or JSON
  timestamp: Date;             // Last modified time
  filePath: string;            // ~/.antigravity/sessions/xxx.json
  goal?: string;               // User's original request
  planSteps?: PlanStep[];      // AG's plan
  executionState?: ExecState;  // Current progress
}
```

**Search Paths (in order):**
1. `~/.antigravity/sessions/*.json`
2. `~/.config/antigravity/sessions/*.json` (Linux alternative)
3. `%APPDATA%/Antigravity/sessions/*.json` (Windows)
4. Environment variable `$AG_SESSION_DIR` (user override)

**Error Handling:**
- If no sessions found → warning message, proceed without context
- If session file corrupted → log error, skip that session
- If permission denied → suggest `chmod` fix

***

### Feature 2: Session State Parser

**Specification:**
```typescript
interface SessionParser {
  // Parse AG's proprietary JSON format
  parse(filePath: string): Promise<ParsedSession>;
  
  // Validate structure (handle format changes)
  validate(json: any): ValidationResult;
}

interface ParsedSession {
  goal: string;                    // "Build REST API with auth"
  planSteps: PlanStep[];
  currentStep: number;             // Index in plan
  completedSteps: PlanStep[];
  pendingSteps: PlanStep[];
  filesModified: string[];         // Paths relative to project
  variables: Record<string, any>;  // AG's runtime variables
  terminalHistory?: string[];      // Commands AG ran
  errors?: string[];               // Any errors AG encountered
}

interface PlanStep {
  id: string;                      // "step-1", "step-2"
  action: string;                  // "Implement user model"
  status: 'pending' | 'executing' | 'completed' | 'failed';
  artifacts?: string[];            // Files created/modified
  output?: string;                 // Execution output
  timestamp?: Date;
}
```

**Parsing Strategy (Resilient):**
```typescript
class ResilientParser implements SessionParser {
  async parse(filePath: string): Promise<ParsedSession> {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Try known format patterns (v1, v2, etc.)
    const formats = [this.parseV1, this.parseV2, this.parseGeneric];
    
    for (const formatParser of formats) {
      try {
        const result = await formatParser(raw);
        if (result.isValid) return result;
      } catch (e) {
        continue; // Try next format
      }
    }
    
    // Fallback: extract what we can
    return this.parseGeneric(raw);
  }
  
  private parseGeneric(raw: any): ParsedSession {
    // Use heuristics to extract info even if format unknown
    return {
      goal: this.extractGoal(raw),           // Look for "goal", "task", "prompt"
      planSteps: this.extractSteps(raw),     // Look for "plan", "steps", "actions"
      filesModified: this.extractFiles(raw), // Look for "files", "artifacts"
      // ...
    };
  }
}
```

***

### Feature 3: Context Injection Engine

**Specification:**
```typescript
interface ContextInjector {
  // Build system message from AG session
  buildContextMessage(session: ParsedSession): string;
  
  // Inject into Claude Code message array
  injectContext(
    messages: Message[], 
    session: ParsedSession
  ): Message[];
}
```

**Context Message Format:**
```typescript
buildContextMessage(session: ParsedSession): string {
  return `
# 🔄 CONTINUING FROM ANTIGRAVITY SESSION

## Original Goal
${session.goal}

## Progress Summary
${this.buildProgressSummary(session)}

## Completed Steps
${session.completedSteps.map((s, i) => 
  `${i+1}. ✅ ${s.action}`
).join('\n')}

## Pending Steps
${session.pendingSteps.map((s, i) => 
  `${i+1}. ⧗ ${s.action}`
).join('\n')}

## Files Modified by Antigravity
${session.filesModified.map(f => `- ${f}`).join('\n')}

## Current Execution State
- Current step: ${session.planSteps[session.currentStep]?.action}
- Variables: ${JSON.stringify(session.variables, null, 2)}

## Your Task
Continue from where Antigravity left off. The user's new request follows below.
`;
}
```

**Injection Strategy:**
```typescript
injectContext(messages: Message[], session: ParsedSession): Message[] {
  const contextMsg: Message = {
    role: 'system',
    content: this.buildContextMessage(session),
    metadata: {
      source: 'antigravity-session',
      sessionId: session.sessionId,
      timestamp: new Date().toISOString()
    }
  };
  
  // Insert before user's first message
  return [contextMsg, ...messages];
}
```

***

### Feature 4: CLI Commands (User-Facing)

**Command 1: Continue from Latest Session**
```bash
cc-mirror send --continue-from-ag "Add rate limiting"

# Equivalent to:
# 1. Find latest AG session
# 2. Parse and inject context
# 3. Send "Add rate limiting" with context
```

**Command 2: List Available Sessions**
```bash
cc-mirror list-ag-sessions

# Output:
# Recent Antigravity Sessions:
# 
# 1. session-abc123 (2 hours ago)
#    Goal: Build REST API with authentication
#    Progress: 3/5 steps completed
#    Modified: 8 files
#
# 2. session-def456 (5 hours ago)
#    Goal: Fix database migration bug
#    Progress: Completed
#    Modified: 2 files
#
# Use: cc-mirror send --ag-session session-abc123 "message"
```

**Command 3: Continue from Specific Session**
```bash
cc-mirror send --ag-session session-abc123 "Add tests for auth"
```

**Command 4: Show Session Details**
```bash
cc-mirror show-ag-session session-abc123

# Output:
# Session: session-abc123
# Created: 2026-01-07 08:00:00
# Last Modified: 2026-01-07 10:30:00
#
# Goal: Build REST API with authentication
#
# Plan:
# ✅ 1. Design database schema (completed 08:15)
# ✅ 2. Implement user model (completed 08:45)
# ✅ 3. Create auth middleware (completed 09:30)
# 🔄 4. Write API routes (in progress)
# ⧗ 5. Add tests
#
# Files Modified:
# - src/models/user.js (created)
# - src/middleware/auth.js (created)
# - src/db/schema.sql (modified)
# - package.json (modified)
#
# Variables:
# - DB_NAME: "myapp_db"
# - AUTH_METHOD: "JWT"
```

***

## 🔧 Implementation Plan

### Sprint 1: State Bridge Foundation (Weeks 1-2)

#### Week 1: Discovery + Parsing

**Engineer 1: Session Discovery**
```typescript
// File: src/state-bridge/session-discovery.ts

export class SessionDiscovery {
  private searchPaths: string[];
  
  constructor() {
    this.searchPaths = [
      path.join(os.homedir(), '.antigravity', 'sessions'),
      path.join(os.homedir(), '.config', 'antigravity', 'sessions'),
      process.env.AG_SESSION_DIR
    ].filter(Boolean);
  }
  
  async findSessions(): Promise<AGSession[]> {
    const sessions: AGSession[] = [];
    
    for (const basePath of this.searchPaths) {
      if (!fs.existsSync(basePath)) continue;
      
      const files = fs.readdirSync(basePath)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(basePath, f));
      
      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          sessions.push({
            sessionId: this.extractSessionId(file),
            timestamp: stats.mtime,
            filePath: file
          });
        } catch (e) {
          logger.warn(`Failed to read session ${file}:`, e);
        }
      }
    }
    
    // Sort by most recent first
    return sessions.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
  
  async getLatestSession(): Promise<AGSession | null> {
    const sessions = await this.findSessions();
    return sessions[0] || null;
  }
  
  private extractSessionId(filePath: string): string {
    // Extract from filename: session-abc123.json → abc123
    const filename = path.basename(filePath, '.json');
    return filename.replace('session-', '');
  }
}
```

**Deliverable:** CLI command `cc-mirror list-ag-sessions` works  
**Testing:** Create mock session files, verify discovery  

***

**Engineer 2: Session Parser (Reverse Engineering)**

**Step 1: Create Test Session in AG**
```bash
# Manual testing procedure
1. Install Antigravity IDE
2. Start new session: "Create a simple Express server"
3. Let AG complete 2-3 steps
4. Locate session file: ~/.antigravity/sessions/*.json
5. Document JSON structure
```

**Step 2: Implement Parser**
```typescript
// File: src/state-bridge/session-parser.ts

export class SessionParser {
  async parse(filePath: string): Promise<ParsedSession> {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Attempt to parse known format
    if (this.isFormatV1(raw)) {
      return this.parseV1(raw);
    }
    
    // Fallback to generic extraction
    return this.parseGeneric(raw);
  }
  
  private parseV1(raw: any): ParsedSession {
    // Actual structure depends on AG's format
    // This is a HYPOTHETICAL example based on common patterns
    return {
      goal: raw.initialPrompt || raw.goal || raw.task,
      planSteps: (raw.plan || []).map(step => ({
        id: step.id || step.stepId,
        action: step.description || step.action,
        status: this.normalizeStatus(step.status),
        artifacts: step.files || step.artifacts || [],
        output: step.result || step.output
      })),
      currentStep: raw.currentStepIndex || 0,
      filesModified: this.extractModifiedFiles(raw),
      variables: raw.state?.variables || raw.variables || {},
      terminalHistory: raw.terminalHistory || []
    };
  }
  
  private parseGeneric(raw: any): ParsedSession {
    // Use heuristics when format is unknown
    return {
      goal: this.findGoalInObject(raw),
      planSteps: this.findStepsInObject(raw),
      filesModified: this.findFilesInObject(raw),
      // ... best-effort extraction
    };
  }
  
  private findGoalInObject(obj: any): string {
    // Recursively search for likely goal fields
    const goalKeys = ['goal', 'task', 'prompt', 'initialPrompt', 'request'];
    
    for (const key of goalKeys) {
      if (obj[key] && typeof obj[key] === 'string') {
        return obj[key];
      }
    }
    
    // Check nested objects
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.findGoalInObject(value);
        if (result) return result;
      }
    }
    
    return 'Unknown goal (AG session format not recognized)';
  }
}
```

**Deliverable:** Can parse AG sessions and extract key info  
**Testing:** Unit tests with mock AG JSON structures  

***

#### Week 2: Context Injection

**Engineer 1: Context Builder**
```typescript
// File: src/state-bridge/context-injector.ts

export class ContextInjector {
  buildContextMessage(session: ParsedSession): string {
    const sections: string[] = [];
    
    // Header
    sections.push('# 🔄 CONTINUING FROM ANTIGRAVITY SESSION\n');
    
    // Goal
    if (session.goal) {
      sections.push(`## Original Goal\n${session.goal}\n`);
    }
    
    // Progress summary
    const completed = session.completedSteps.length;
    const total = session.planSteps.length;
    const percentage = total > 0 ? Math.round((completed/total) * 100) : 0;
    sections.push(`## Progress: ${completed}/${total} steps (${percentage}%)\n`);
    
    // Completed steps
    if (session.completedSteps.length > 0) {
      sections.push('## Completed Steps');
      session.completedSteps.forEach((step, i) => {
        sections.push(`${i+1}. ✅ ${step.action}`);
        if (step.artifacts?.length) {
          sections.push(`   Files: ${step.artifacts.join(', ')}`);
        }
      });
      sections.push('');
    }
    
    // Current/Pending steps
    if (session.pendingSteps.length > 0) {
      sections.push('## Pending Steps');
      session.pendingSteps.forEach((step, i) => {
        const icon = i === 0 ? '🔄' : '⧗';
        sections.push(`${i+1}. ${icon} ${step.action}`);
      });
      sections.push('');
    }
    
    // Files modified
    if (session.filesModified.length > 0) {
      sections.push('## Files Modified by Antigravity');
      session.filesModified.forEach(file => {
        sections.push(`- ${file}`);
      });
      sections.push('');
    }
    
    // Variables
    if (Object.keys(session.variables).length > 0) {
      sections.push('## Session Variables');
      sections.push('```json');
      sections.push(JSON.stringify(session.variables, null, 2));
      sections.push('```\n');
    }
    
    // Closing instruction
    sections.push('## Your Task');
    sections.push('Continue from where Antigravity left off. ');
    sections.push('Review the context above and proceed with the user\'s request.\n');
    
    return sections.join('\n');
  }
  
  injectContext(
    messages: Message[], 
    session: ParsedSession
  ): Message[] {
    const contextMsg: Message = {
      role: 'system',
      content: this.buildContextMessage(session),
      metadata: {
        source: 'antigravity-session',
        sessionId: session.sessionId,
        injectedAt: new Date().toISOString()
      }
    };
    
    // Insert at the beginning
    return [contextMsg, ...messages];
  }
}
```

**Deliverable:** Context messages are human-readable and informative  
**Testing:** Visual review of generated context messages  

***

**Engineer 2: CLI Integration**
```typescript
// File: src/cli/commands/send.ts

import { SessionDiscovery } from '../state-bridge/session-discovery';
import { SessionParser } from '../state-bridge/session-parser';
import { ContextInjector } from '../state-bridge/context-injector';

export async function sendCommand(options: SendOptions) {
  const messages = buildMessages(options.message);
  
  // Handle --continue-from-ag flag
  if (options.continueFromAg) {
    const discovery = new SessionDiscovery();
    const session = options.agSession 
      ? await discovery.getSessionById(options.agSession)
      : await discovery.getLatestSession();
    
    if (!session) {
      logger.warn('No Antigravity sessions found. Proceeding without context.');
      logger.info('Tip: Complete a task in Antigravity IDE first.');
    } else {
      const parser = new SessionParser();
      const parsed = await parser.parse(session.filePath);
      
      const injector = new ContextInjector();
      const enhancedMessages = injector.injectContext(messages, parsed);
      
      logger.info(`✅ Loaded context from AG session: ${session.sessionId}`);
      logger.info(`   Goal: ${parsed.goal}`);
      logger.info(`   Progress: ${parsed.completedSteps.length}/${parsed.planSteps.length} steps`);
      
      return sendToProvider(enhancedMessages, options);
    }
  }
  
  // Normal flow (no AG context)
  return sendToProvider(messages, options);
}
```

**Deliverable:** `cc-mirror send --continue-from-ag` works end-to-end  
**Testing:** Integration test with mock AG session  

***

### Sprint 2: Core Antigravity Provider (Weeks 3-4)

**Same as original TDD:**
- OAuth Manager (google-auth-library)
- API Translator (Anthropic → Google Gen AI)
- Tool Hallucination Prevention
- Thinking Mode Sanitization
- Account Pool Manager

**No changes needed** - this layer is independent of state bridge.

***

### Sprint 3: Polish + Testing (Weeks 5-6)

#### Week 5: Error Handling + Resilience

**Engineer 1: Format Evolution Handling**
```typescript
// File: src/state-bridge/format-detector.ts

export class FormatDetector {
  private knownFormats: FormatDefinition[] = [
    {
      version: 'v1',
      identifier: (obj) => obj.hasOwnProperty('plan') && obj.hasOwnProperty('initialPrompt'),
      parser: (obj) => this.parseV1(obj)
    },
    {
      version: 'v2',
      identifier: (obj) => obj.hasOwnProperty('agentPlan') && obj.hasOwnProperty('execution'),
      parser: (obj) => this.parseV2(obj)
    }
  ];
  
  async detectAndParse(raw: any): Promise<ParsedSession> {
    // Try known formats first
    for (const format of this.knownFormats) {
      if (format.identifier(raw)) {
        logger.debug(`Detected AG format: ${format.version}`);
        return format.parser(raw);
      }
    }
    
    // Fallback to generic
    logger.warn('Unknown AG session format, using generic parser');
    return this.parseGeneric(raw);
  }
  
  // When AG updates their format, add new parser here
  addFormat(format: FormatDefinition) {
    this.knownFormats.push(format);
  }
}
```

**Deliverable:** System gracefully handles AG format changes  
**Testing:** Create test cases for multiple format versions  

***

**Engineer 2: User-Friendly Error Messages**
```typescript
// File: src/state-bridge/error-handler.ts

export class StateBridgeErrorHandler {
  handle(error: Error, context: ErrorContext): void {
    if (error instanceof SessionNotFoundError) {
      console.error('❌ No Antigravity sessions found.\n');
      console.error('Possible causes:');
      console.error('  1. You haven\'t used Antigravity IDE yet');
      console.error('  2. Sessions are in a non-standard location');
      console.error('  3. Session files were deleted\n');
      console.error('Solutions:');
      console.error('  • Complete a task in Antigravity IDE first');
      console.error('  • Set AG_SESSION_DIR environment variable');
      console.error('  • Use cc-mirror without --continue-from-ag flag\n');
      return;
    }
    
    if (error instanceof SessionParseError) {
      console.error('⚠️  Failed to parse Antigravity session.\n');
      console.error('This may happen if:');
      console.error('  • Antigravity updated their format');
      console.error('  • Session file is corrupted\n');
      console.error('Proceeding without AG context...\n');
      return;
    }
    
    // Generic error
    console.error('❌ State bridge error:', error.message);
    console.error('Proceeding without AG context...\n');
  }
}
```

**Deliverable:** Users understand why things fail and how to fix  
**Testing:** Manually trigger error conditions, verify messages  

***

#### Week 6: Documentation + Integration Testing

**Engineer 1: User Documentation**
```markdown
# File: docs/antigravity-integration.md

# Antigravity Integration Guide

## Overview

cc-mirror can read Antigravity IDE's session state and inject it into Claude Code CLI conversations. This allows you to start work in Antigravity, then seamlessly continue in Claude Code.

## Quick Start

### Step 1: Work in Antigravity IDE

\`\`\`bash
# Open your project in Antigravity IDE
ag-agent "Build a REST API with user authentication"

# Let Antigravity complete a few steps
# (e.g., create database schema, implement user model)
\`\`\`

### Step 2: Continue in Claude Code

\`\`\`bash
# Switch to Claude Code CLI with context injection
cc-mirror send --continue-from-ag "Add rate limiting to the API"

# Claude Code will see:
# - Antigravity's original goal
# - Steps already completed
# - Files modified
# - Current progress
\`\`\`

## Commands

### Continue from Latest Session
\`\`\`bash
cc-mirror send --continue-from-ag "your message"
\`\`\`
Automatically finds and loads the most recent Antigravity session.

### List Available Sessions
\`\`\`bash
cc-mirror list-ag-sessions
\`\`\`
Shows recent sessions with summary.

### Continue from Specific Session
\`\`\`bash
cc-mirror send --ag-session session-abc123 "your message"
\`\`\`
Loads a specific session by ID.

### Show Session Details
\`\`\`bash
cc-mirror show-ag-session session-abc123
\`\`\`
Displays full session information.

## Configuration

### Custom Session Directory

If Antigravity stores sessions in a non-standard location:

\`\`\`bash
export AG_SESSION_DIR=/path/to/sessions
cc-mirror send --continue-from-ag "message"
\`\`\`

### Disable Context Injection

If you don't want AG context (use Claude Code independently):

\`\`\`bash
cc-mirror send "message"
# (no --continue-from-ag flag)
\`\`\`

## Troubleshooting

### "No sessions found"
- Ensure you've used Antigravity IDE at least once
- Check that `~/.antigravity/sessions/` exists
- Verify session files are JSON format

### "Failed to parse session"
- Antigravity may have updated their format
- File `cc-mirror --version` to check for updates
- Report issue at: [repo URL]

### Context seems outdated
- cc-mirror reads session files at command time
- Ensure you saved work in Antigravity before switching
- Check session timestamp: `cc-mirror show-ag-session <id>`

## Limitations

### One-Way Context Flow
- cc-mirror → Antigravity: ❌ Not supported
- Antigravity → cc-mirror: ✅ Supported

When you switch back to Antigravity IDE, it will NOT see work done in Claude Code.

### Format Stability
- cc-mirror uses heuristics to parse AG sessions
- May break if Antigravity significantly changes format
- We update parsers with each cc-mirror release

## Best Practices

### When to Use Context Injection
✅ Good use cases:
- Continuing multi-step plans
- Adding features to AG-scaffolded projects
- Debugging code AG wrote

❌ Not recommended:
- Starting fresh projects (no AG context needed)
- When AG session is >24 hours old (context may be stale)

### Workflow Tips
1. Use Antigravity for scaffolding/planning
2. Switch to Claude Code for detailed implementation
3. Commit changes frequently (preserves AG context)
4. Re-run in AG if you need new planning

## Examples

### Example 1: Full Stack App

\`\`\`bash
# In Antigravity IDE
ag-agent "Create a todo app with React and Express"
# AG scaffolds: frontend/, backend/, database schema

# Switch to Claude Code
cc-mirror send --continue-from-ag \
  "Add user authentication with JWT"
# Claude sees AG's structure and continues

cc-mirror send --continue-from-ag \
  "Write tests for the auth flow"
# Still in same context
\`\`\`

### Example 2: Bug Fix

\`\`\`bash
# In Antigravity IDE
ag-agent "Fix the database connection timeout issue"
# AG investigates, modifies config files

# Switch to Claude Code
cc-mirror send --continue-from-ag \
  "Add retry logic with exponential backoff"
# Claude knows AG already changed connection settings
\`\`\`
```

**Deliverable:** Complete user guide with examples  

***

**Engineer 2: Integration Testing**
```typescript
// File: tests/integration/state-bridge.test.ts

describe('State Bridge Integration', () => {
  beforeEach(() => {
    // Create mock AG session directory
    setupMockAGSessions();
  });
  
  it('should discover and parse AG sessions', async () => {
    const discovery = new SessionDiscovery();
    const sessions = await discovery.findSessions();
    
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty('sessionId');
  });
  
  it('should inject context into messages', async () => {
    const discovery = new SessionDiscovery();
    const session = await discovery.getLatestSession();
    const parser = new SessionParser();
    const parsed = await parser.parse(session.filePath);
    
    const injector = new ContextInjector();
    const messages = [{ role: 'user', content: 'Continue' }];
    const enhanced = injector.injectContext(messages, parsed);
    
    expect(enhanced.length).toBe(2); // system + user
    expect(enhanced[0].role).toBe('system');
    expect(enhanced[0].content).toContain('CONTINUING FROM ANTIGRAVITY');
  });
  
  it('should handle missing sessions gracefully', async () => {
    // Delete mock sessions
    clearMockAGSessions();
    
    const discovery = new SessionDiscovery();
    const session = await discovery.getLatestSession();
    
    expect(session).toBeNull();
    // Should not throw error
  });
  
  it('should handle corrupted session files', async () => {
    // Create invalid JSON file
    createCorruptedSession();
    
    const parser = new SessionParser();
    
    await expect(async () => {
      await parser.parse('/path/to/corrupted.json');
    }).rejects.toThrow(SessionParseError);
  });
  
  it('should work end-to-end with real AG session', async () => {
    // This requires actual Antigravity IDE
    // Mark as @integration-manual for now
    
    const result = await sendCommand({
      message: 'Continue building',
      continueFromAg: true,
      provider: 'antigravity'
    });
    
    expect(result.success).toBe(true);
  });
});
```

**Deliverable:** 90% code coverage, all tests pass  

***

## 📊 Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session Discovery Success Rate | >95% | % of times sessions found when AG used |
| Parse Success Rate | >90% | % of sessions parsed without errors |
| Context Injection Latency | <100ms | Time to read + parse + inject |
| False Positive Detection | <5% | % of non-AG files parsed by mistake |
| Format Evolution Resilience | 2 versions | Can handle 2 AG format versions |

### User Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context Handoff Clarity | >4/5 | User rating: "Claude understood AG context" |
| Setup Time | <2 min | Time from install to first --continue-from-ag |
| Error Recovery Rate | >90% | % of errors users can resolve themselves |
| Workflow Adoption | >50% | % of users using --continue-from-ag weekly |

***

## 🚨 Risk Management

### Risk 1: Antigravity Format Changes

**Probability:** High (60%)  
**Impact:** Medium  
**Mitigation:**
- Use generic parser as fallback
- Monitor AG releases for format changes
- Automated tests fail if format breaks
- Graceful degradation (proceed without context)

**Contingency:**
```typescript
// Auto-update mechanism (future)
async checkFormatUpdates() {
  const latestParsers = await fetchFromRegistry(
    'https://registry.cc-mirror.io/ag-parsers/latest'
  );
  if (latestParsers.version > CURRENT_VERSION) {
    logger.info('New AG parser available, updating...');
    await installParser(latestParsers);
  }
}
```

***

### Risk 2: Session Files in Non-Standard Locations

**Probability:** Medium (40%)  
**Impact:** Low  
**Mitigation:**
- Support `AG_SESSION_DIR` environment variable
- Search multiple common paths
- Clear error messages with solutions
- FAQ in documentation

**User Workaround:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export AG_SESSION_DIR=/custom/path/to/sessions
```

***

### Risk 3: Large Session Files

**Probability:** Low (20%)  
**Impact:** Medium (performance degradation)  
**Mitigation:**
- Stream parsing for files >1MB
- Extract only essential info (don't load full output)
- Warn if session >10MB
- Implement pagination for file lists

```typescript
async parse(filePath: string): Promise<ParsedSession> {
  const stats = fs.statSync(filePath);
  
  if (stats.size > 10 * 1024 * 1024) { // 10MB
    logger.warn('Large session file detected, using streaming parser');
    return this.parseStream(filePath);
  }
  
  return this.parseSync(filePath);
}
```

***

### Risk 4: Stale Context Injection

**Probability:** Medium (50%)  
**Impact:** Low (user confusion)  
**Mitigation:**
- Show session timestamp in injected context
- Warn if session >24 hours old
- Allow users to force refresh

```typescript
buildContextMessage(session: ParsedSession): string {
  const age = Date.now() - session.timestamp.getTime();
  const hours = Math.floor(age / (1000 * 60 * 60));
  
  let warning = '';
  if (hours > 24) {
    warning = `\n⚠️  **Note:** This session is ${hours} hours old. Context may be outdated.\n`;
  }
  
  return `
# 🔄 CONTINUING FROM ANTIGRAVITY SESSION
Last updated: ${session.timestamp.toLocaleString()}
${warning}
...
`;
}
```

***

## 🎯 Non-Goals (Out of Scope)

### ❌ Bidirectional Sync
- cc-mirror will NOT write back to AG sessions
- Antigravity IDE will NOT see Claude Code's work
- Rationale: Requires AG's cooperation (not feasible)

### ❌ Real-Time State Monitoring
- No file watching or live updates
- Context loaded once at command invocation
- Rationale: Adds complexity without clear user benefit

### ❌ Session Editing/Management
- No `cc-mirror delete-ag-session`
- No `cc-mirror edit-ag-session`
- Rationale: Risk of corrupting AG's state

### ❌ AG-to-AG Session Sharing
- No multi-user session sharing
- Each user has their own local sessions
- Rationale: Security + complexity

***

## 📅 Delivery Timeline

### Week 1-2: State Bridge Core
- Sprint goal: `cc-mirror list-ag-sessions` works
- Deliverables:
  - Session discovery ✅
  - Basic parser ✅
  - CLI command ✅

### Week 3-4: Antigravity Provider
- Sprint goal: API integration complete (same as original TDD)
- Deliverables:
  - OAuth ✅
  - API translation ✅
  - Tool prevention ✅
  - Thinking sanitization ✅

### Week 5: Integration
- Sprint goal: `cc-mirror send --continue-from-ag` works end-to-end
- Deliverables:
  - Context injection ✅
  - Error handling ✅
  - Format resilience ✅

### Week 6: Polish
- Sprint goal: Production-ready
- Deliverables:
  - Documentation ✅
  - Integration tests ✅
  - Performance optimization ✅
  - Beta release ✅

***

## ✅ Acceptance Criteria

### Must Have (MVP)
- ✅ User can run `cc-mirror send --continue-from-ag "message"`
- ✅ Latest AG session is auto-detected
- ✅ Context includes: goal, steps, files
- ✅ Works on Linux, macOS, Windows
- ✅ Graceful failure if no sessions found
- ✅ Documentation with examples

### Should Have (Nice to Have)
- ✅ `cc-mirror list-ag-sessions` command
- ✅ `cc-mirror show-ag-session <id>` command
- ✅ Support for `AG_SESSION_DIR` override
- ✅ Warning for stale sessions (>24hr)

### Could Have (Future Enhancements)
- 🔮 Auto-update mechanism for parsers
- 🔮 Web dashboard showing AG sessions
- 🔮 Session diff viewer (what changed)
- 🔮 Export session to Markdown

***

## 🚀 Launch Plan

### Beta Phase (Week 7)
- Deploy to 10 beta testers
- Collect feedback on:
  - Context quality ("Did Claude understand AG's work?")
  - Parser reliability ("Did it parse your sessions?")
  - Error messages ("Were failures clear?")
- Fix critical bugs

### General Availability (Week 8)
- Release cc-mirror v2.0 with state bridge
- Publish blog post: "Seamless Antigravity + Claude Code Workflows"
- Update main documentation
- Monitor error logs for parse failures

### Post-Launch (Week 9+)
- Add support for new AG format versions (as needed)
- Optimize performance based on telemetry
- Build parser update registry

***

## 📞 Support & Maintenance

### Community Support
- GitHub Discussions for questions
- FAQ section in docs
- Example session files in repo

### Format Updates
- Monitor AG release notes
- Test with new AG versions within 48 hours
- Release parser updates within 1 week

### Telemetry (Opt-in)
```typescript
// Collect anonymous usage stats
{
  "event": "ag_context_injection",
  "success": true,
  "parse_method": "v1" | "v2" | "generic",
  "session_age_hours": 2,
  "files_modified_count": 5,
  "plan_steps_count": 7
}
```

Use data to:
- Prioritize parser improvements
- Identify common failure patterns
- Guide feature development

***

## 🎬 APPROVAL STATUS

**Product Owner:** ✅ APPROVED (Path 2)  
**Engineering Director:** ⏳ PENDING REVIEW  
**System Architect:** ⏳ PENDING REVIEW  

**Next Action:** Tech Lead to present this PRD in architecture review meeting (January 7, 2026, 2:00 PM SGT)

***

**END OF PRD v2.0**
