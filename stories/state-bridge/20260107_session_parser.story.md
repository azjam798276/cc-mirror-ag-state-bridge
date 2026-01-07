---
id: "20260107_session_parser"
difficulty: "hard"
tags: ["state-bridge", "parsing", "json", "typescript", "resilience"]
tech_stack: "Node.js 18+, TypeScript 5.x"
---

# User Story
As a developer, I want cc-mirror to parse Antigravity session files reliably, so I can get my work context even if AG's format changes.

# Context & Constraints
**Interface Requirements (SessionParser):**
```typescript
interface SessionParser {
  parse(filePath: string): Promise<ParsedSession>;
  registerFormat(detector: FormatDetector): void;
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

interface PlanStep {
  id: string;
  action: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  artifacts?: string[];
}
```

**Format Detection Strategy:**
1. Try known format v1 (legacy)
2. Try known format v2 (current)
3. Fallback to generic heuristic parser

**Constraints:**
| Constraint | Threshold |
|------------|-----------|
| Max file size | 50MB (throw error) |
| Parse time (<1MB) | < 100ms |
| Recursion depth (generic) | 3 levels |

# Acceptance Criteria
- [ ] **Format v1:** Parse `{ initialPrompt, plan[], status }` structure
- [ ] **Format v2:** Parse `{ goal, steps[], execution }` structure
- [ ] **Generic Fallback:** Extract goal/steps using heuristic field search
- [ ] **Size Guard:** Throw `SessionParseError` for files > 50MB
- [ ] **Malformed JSON:** Throw `SessionParseError` with line number
- [ ] **Partial Success:** Extract what's possible, fill missing with defaults
- [ ] **Extensible:** Allow registering new format detectors at runtime
