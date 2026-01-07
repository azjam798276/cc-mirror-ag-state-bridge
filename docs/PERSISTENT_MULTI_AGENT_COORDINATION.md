# Persistent Multi-Agent Coordination for AI Coding Assistants

Based on Steve Yegge's **Gastown** architecture and production patterns from the AI coding community, here's how to implement continuous multi-agent coordination.

## 1. Gastown Architecture Overview

Gastown solves the fundamental problem: **agents lose context on restart**. Here's the core architecture:

### Key Components

```typescript
// Gastown's persistent work tracking system
interface GastownArchitecture {
  // Mayor: AI coordinator that orchestrates agents
  mayor: MayorAgent;
  
  // Hooks: Git-backed persistent storage (survives crashes)
  hooks: Hook[];
  
  // Beads: Work tracking units (git-backed issue tracker)
  beads: Bead[];
  
  // Convoy: Ephemeral worker agents
  convoy: ConvoyAgent[];
  
  // Rigs: Project-specific workspaces
  rigs: Rig[];
}

interface Hook {
  agentId: string;
  workState: WorkState;
  gitWorktreePath: string;  // ~/gt/hooks/agent-123
  lastHeartbeat: Date;
  status: "active" | "suspended" | "completed";
}

interface Bead {
  beadId: string;
  tasks: Task[];
  assignedAgents: string[];
  gitCommitHash: string;  // All state stored in git
  metadata: {
    created: Date;
    updated: Date;
    progress: number;
  };
}

interface WorkState {
  currentTask: Task;
  context: string[];  // File paths, previous results
  messages: Message[];  // Agent communication history
  checkpoints: Checkpoint[];  // Rollback points
}
```

**Why This Works:**
- Work persists in **git-backed hooks**, not agent memory.
- Git worktrees enable **parallel development** without conflicts.
- Agents can crash/restart without losing progress.
- Scales to 20-30 agents vs 4-10 without orchestration.

***

## 2. Mayor-Enhanced Orchestration Workflow (MEOW)

The **Mayor** is the continuous coordinator that never sleeps.

### Implementation Pattern

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MayorConfig {
  pollingInterval: number;  // 30s, 60s, 120s
  maxConcurrentAgents: number;
  hooksDirectory: string;
  beadsDirectory: string;
}

class MayorOrchestrator {
  private config: MayorConfig;
  private activeAgents: Map<string, AgentHandle> = new Map();
  private taskQueue: Task[] = [];
  private running: boolean = false;

  constructor(config: MayorConfig) {
    this.config = config;
  }

  /**
   * Main orchestration loop - runs continuously
   * Pattern from Gastown: Mayor continuously monitors and dispatches
   */
  async start() {
    this.running = true;
    console.log(`[Mayor] Starting orchestration loop (interval: ${this.config.pollingInterval}ms)`);

    while (this.running) {
      try {
        await this.orchestrationCycle();
      } catch (error) {
        console.error('[Mayor] Orchestration cycle error:', error);
      }

      // Wait before next cycle
      await this.sleep(this.config.pollingInterval);
    }
  }

  /**
   * Single orchestration cycle
   */
  private async orchestrationCycle() {
    const cycleStart = Date.now();
    console.log(`\n[Mayor] === Orchestration Cycle ${new Date().toISOString()} ===`);

    // Step 1: Read hooks to discover agent states
    const hooks = await this.discoverHooks();
    console.log(`[Mayor] Discovered ${hooks.length} hooks`);

    // Step 2: Check heartbeats and detect stalled agents
    await this.checkHeartbeats(hooks);

    // Step 3: Read beads to get pending work
    const beads = await this.loadBeads();
    const pendingTasks = this.extractPendingTasks(beads);
    console.log(`[Mayor] ${pendingTasks.length} pending tasks`);

    // Step 4: Dispatch tasks to available agents
    await this.dispatchTasks(pendingTasks, hooks);

    // Step 5: Aggregate status from active agents
    const status = await this.aggregateStatus(hooks);
    
    // Step 6: Persist orchestration state to git
    await this.persistState(status);

    const cycleDuration = Date.now() - cycleStart;
    console.log(`[Mayor] Cycle complete in ${cycleDuration}ms`);
  }

  /**
   * Discover hooks from git worktrees
   * Pattern: Hooks are git-backed, so we read from filesystem
   */
  private async discoverHooks(): Promise<Hook[]> {
    const hooksPath = this.config.hooksDirectory;
    const hooks: Hook[] = [];

    const entries = await fs.readdir(hooksPath);

    for (const entry of entries) {
      const hookPath = path.join(hooksPath, entry);
      const statePath = path.join(hookPath, 'state.json');

      if (await fs.pathExists(statePath)) {
        const state = await fs.readJSON(statePath);
        
        hooks.push({
          agentId: entry,
          workState: state.workState,
          gitWorktreePath: hookPath,
          lastHeartbeat: new Date(state.lastHeartbeat),
          status: state.status
        });
      }
    }

    return hooks;
  }

  /**
   * Check agent heartbeats and restart stalled agents
   * Pattern: Agents write heartbeat timestamps to their hooks
   */
  private async checkHeartbeats(hooks: Hook[]) {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const hook of hooks) {
      const age = now - hook.lastHeartbeat.getTime();

      if (age > STALE_THRESHOLD && hook.status === 'active') {
        console.warn(`[Mayor] Agent ${hook.agentId} stale (${Math.floor(age / 1000)}s), restarting...`);
        await this.restartAgent(hook);
      }
    }
  }

  /* ... additional methods ... */
}
```

***

## 3. Worker Agent with Heartbeat

Worker agents must **actively signal they're alive**.

```typescript
class WorkerAgent {
  private agentId: string;
  private hookPath: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(agentId: string, hookPath: string) {
    this.agentId = agentId;
    this.hookPath = hookPath;
  }

  /**
   * Heartbeat pattern: Write timestamp every 30s
   * Pattern from distributed systems
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const state = await this.loadState();
        state.lastHeartbeat = new Date();
        await this.saveState(state);
        
        console.log(`[Agent ${this.agentId}] ❤️ Heartbeat`);
      } catch (error) {
        console.error(`[Agent ${this.agentId}] Heartbeat failed:`, error);
      }
    }, 30000); // 30 seconds
  }

  /* ... work cycle methods ... */
}
```

***

## 4. Engineering Director Polling Pattern

The director **requests periodic status updates** rather than waiting.

```typescript
class EngineeringDirector {
  private pollingInterval: number = 120000; // 2 minutes
  private running: boolean = false;

  /**
   * Continuous review loop
   * Pattern: Director actively monitors, doesn't wait for requests
   */
  async start() {
    this.running = true;
    console.log('[Director] Starting review loop');

    while (this.running) {
      try {
        await this.reviewCycle();
      } catch (error) {
        console.error('[Director] Review cycle error:', error);
      }

      await this.sleep(this.pollingInterval);
    }
  }
}
```

***

## 5. Continuous Claude Pattern

For running Claude Code continuously:

```bash
#!/bin/bash
# continuous-claude.sh
# Pattern from Anand Chowdhary's "Running Claude Code in a loop"

MAX_ITERATIONS=100
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  echo "[Continuous Claude] Iteration $ITERATION at $(date)"
  
  # Run Claude Code with persistent context
  claude-code \
    --dangerously-skip-permissions \
    "$(cat PROMPT.md) Review TASKS.md for current progress. Continue from where you left off." \
    > output-$ITERATION.log 2>&1
  
  # Commit changes to git (persistence)
  git add .
  git commit -m "Iteration $ITERATION" || true
  
  # Heartbeat: Update timestamp
  echo "$(date +%s)" > .claude-heartbeat
  
  ITERATION=$((ITERATION + 1))
  sleep 30
done
```

***

## 6. JSON Message Passing Protocol

Standardized communication between agents:

```typescript
interface AgentMessage {
  messageId: string;
  from: string;
  to: string;
  type: "task_dispatch" | "status_update" | "heartbeat" | "approval_decision";
  payload: any;
  timestamp: Date;
  priority: number;
}
```

***

## 7. Best Practices Summary

### Keep Agents Active
1. **Continuous loops** with 30s/60s/120s intervals.
2. **Heartbeat signals** every 30s to detect stalls.
3. **Mayor polling** orchestrator that never sleeps.
4. **Background processes** that survive VS Code restarts.

### Prevent Dormancy
1. **Task queues** always have work ready.
2. **Scheduled triggers** wake agents periodically.
3. **Event listeners** respond to git commits, PRs, issues.

### Survive Crashes
1. **Git-backed hooks** persist all state.
2. **Checkpoints** save progress incrementally.
3. **Idempotent operations** allow safe restarts.

### Coordinate at Scale
1. **Mailboxes** (message bus) for async communication.
2. **Git worktrees** prevent merge conflicts.
3. **Beads** bundle related tasks for atomic completion.
4. **Structured handoffs** between agents with context.

This architecture enables **20-30 agents** working continuously without manual intervention, surviving crashes, and maintaining coherent state through git persistence.
