# Antigravity IDE Internal Architecture

> **Purpose:** Research documentation for implementing native multi-agent coordination using Antigravity's internal artifact and task systems.

## 1. Brain Directory Structure

Antigravity persists all agent state in:
```
~/.gemini/antigravity/brain/<conversation-id>/
├── task.md                    # Checklist with progress tracking
├── implementation_plan.md     # Technical architecture (PLANNING mode)
├── walkthrough.md             # Verification evidence (VERIFICATION mode)
├── <ad-hoc-files>             # Screenshots, recordings, data
└── .artifact-metadata.json    # Internal state
```

**Key Insight:** Brain directories are **file-system based** and can be:
- Polled by external orchestrator
- Git-tracked for persistence
- Shared across agents via file paths

---

## 2. Task Boundary System

### Tool Schema
```typescript
interface TaskBoundaryCall {
  TaskName: string;          // REQUIRED FIRST - UI header
  Mode: "PLANNING" | "EXECUTION" | "VERIFICATION" | "%SAME%";
  TaskSummary: string;       // Goal description
  TaskStatus: string;        // NEXT STEPS (not previous)
  PredictedTaskSize: number; // Remaining tool calls (1-10)
}
```

### Mode Transitions
```
PLANNING → EXECUTION → VERIFICATION → (loop or complete)
   ↓           ↓            ↓
Create      Write        Test
 Plan        Code         & Verify
```

### When to Use Each Mode
| Mode | Purpose | Output Artifact |
|------|---------|-----------------|
| PLANNING | Design architecture, request approval | `implementation_plan.md` |
| EXECUTION | Write code, update checklist | Source files + `task.md` |
| VERIFICATION | Test, screenshot, record | `walkthrough.md` |

---

## 3. Notify User Control Flow

```typescript
interface NotifyUserCall {
  PathsToReview?: string[];     // Absolute paths to artifacts
  ConfidenceScore: number;      // 0.0-1.0
  ConfidenceJustification: string;
  BlockedOnUser: boolean;       // TRUE = agent STOPS until user responds
  Message: string;              // Concise explanation
}
```

**Critical Pattern:**
- `BlockedOnUser: true` → Agent HALTS until user approves
- `BlockedOnUser: false` → Agent continues, user notified async

---

## 4. Multi-Agent Coordination Gap

### What Antigravity Has
- Parallel task conversations via Agent Manager
- Each task has independent brain directory
- Context sharing via conversation summaries
- Global rules in `~/.gemini/GEMINI.md`

### What Antigravity Lacks
- ❌ No orchestrator-worker pattern (like Gastown Mayor)
- ❌ No direct agent-to-agent communication
- ❌ No shared task queue
- ❌ No automatic git worktrees for isolation

---

## 5. Implementation Strategy for cc-mirror

### Option A: External Orchestrator (Recommended)

Build a TypeScript service that:
1. **Launches** Antigravity tasks via API/CLI
2. **Polls** brain directories for artifact completion
3. **Injects** continuation prompts to keep agents active
4. **Aggregates** results from multiple agents

```typescript
class AntigravityOrchestrator {
  private brainBaseDir = "~/.gemini/antigravity/brain";

  async monitorTask(taskId: string): Promise<boolean> {
    const taskMdPath = `${this.brainBaseDir}/${taskId}/task.md`;
    
    // Poll for checklist completion
    while (true) {
      const content = await fs.readFile(taskMdPath, 'utf-8');
      if (this.allCheckboxesComplete(content)) {
        return true;
      }
      await sleep(10000); // 10s polling interval
    }
  }

  async injectContinuation(taskId: string, message: string) {
    // Use Antigravity API or simulate user message
    // This keeps agent from going idle
  }
}
```

### Option B: Native Artifact Polling

Leverage Antigravity's own artifact system:
1. **Orchestrator Agent** writes dispatch to its `task.md`
2. **Worker Agents** poll orchestrator's brain directory
3. **Workers** write status to their own `task.md`
4. **Orchestrator** polls worker brain directories

```markdown
<!-- Orchestrator's task.md -->
# Dispatch Queue
- [ ] P2-001: backend-engineer → context-injector.ts
- [ ] P2-002: qa-engineer → unit tests
- [ ] P2-003: security-engineer → review

# Status Inbox
- ✅ P2-001: backend-engineer COMPLETE (see brain/15b9c503/walkthrough.md)
```

### Option C: GEMINI.md Shared State

Use global rules file as message bus:

```markdown
<!-- ~/.gemini/GEMINI.md -->
<MEMORY[ORCHESTRATOR_DISPATCH]>
{
  "phase": "phase-2-context-injection",
  "tasks": [
    {"id": "P2-001", "agent": "backend-engineer", "status": "dispatched"},
    {"id": "P2-002", "agent": "qa-engineer", "status": "pending"}
  ],
  "last_updated": "2026-01-07T14:30:00Z"
}
</MEMORY[ORCHESTRATOR_DISPATCH]>
```

Workers read this on wake-up and update their section.

---

## 6. Keep-Alive Patterns

### Pattern 1: Self-Continuation in task.md

```markdown
# Task Checklist
- [x] Step 1: Create types.ts
- [/] Step 2: Implement parser (IN PROGRESS)
- [ ] Step 3: Add tests
- [ ] CONTINUE: If idle >60s, proceed to next unchecked item
```

### Pattern 2: Explicit Loop Declaration

In wake command, agent declares:
```
⚡ LOOP MODE: ACTIVE
- Every 60s: Check task.md for next unchecked item
- If all complete: Call notify_user with BlockedOnUser: false
- Never go idle until all items checked
```

### Pattern 3: External Poke Script

```bash
#!/bin/bash
# poke-agent.sh - Run via cron every 60s

BRAIN_DIR="~/.gemini/antigravity/brain/$1"
TASK_MD="$BRAIN_DIR/task.md"

# Check if agent has incomplete tasks
if grep -q "^\- \[ \]" "$TASK_MD"; then
  # Inject continuation message
  echo "Continue with next task" >> "$BRAIN_DIR/.poke"
fi
```

---

## 7. Recommended Architecture for cc-mirror

```
┌─────────────────────────────────────────────────────────┐
│                 External Orchestrator                   │
│  (TypeScript service or bash scripts)                   │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Poll Brain  │  │   Inject    │  │  Aggregate  │     │
│  │ Directories │→ │ Continuations│→ │   Results   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
         ↓                 ↓                 ↓
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Orchestrator│   │   Backend   │   │     QA      │
│   (Mayor)   │   │  Engineer   │   │  Engineer   │
│  e20afd38   │   │  15b9c503   │   │  5858eac3   │
│             │   │             │   │             │
│ brain/      │   │ brain/      │   │ brain/      │
│ ├─task.md   │   │ ├─task.md   │   │ ├─task.md   │
│ └─impl.md   │   │ └─walk.md   │   │ └─walk.md   │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## 8. Action Items

1. **Create orchestrator poller** (`src/orchestrator/brain-poller.ts`)
   - Watch brain directories for task.md changes
   - Detect completion via checkbox parsing
   - Trigger next phase on all-complete

2. **Update wake commands** to declare loop mode
   - Agents must explicitly state they won't idle
   - Include self-continuation instructions

3. **Test brain directory access**
   - Verify agents can read other agents' brain dirs
   - May need to copy artifacts to shared location

4. **Implement continuation injector**
   - Script or service that pokes idle agents
   - Uses Antigravity API or simulates user input

---

## References

- [Antigravity System Prompt Analysis](https://www.linkedin.com/pulse/googles-antigravity-system-prompt-johnmark-obiefuna--cyq6f)
- [Brain Directory Location](https://www.reddit.com/r/GoogleAntigravityIDE/comments/1p79xmz/where_are_the_planning_files_stored/)
- [Antigravity Agent Manager](https://github.com/lbjlaq/Antigravity-Manager/blob/main/README_EN.md)
- [Cross-Conversation Memory](https://www.reddit.com/r/google_antigravity/comments/1p8rw3r/does_antigravity_keep_memory_across_conversations/)
