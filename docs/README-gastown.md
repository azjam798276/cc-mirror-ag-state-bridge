# Gastown Multi-Agent Coordination System

> **External orchestration for Antigravity IDE agent conversations using the MEOW protocol**

[![Status](https://img.shields.io/badge/status-operational-green.svg)]()
[![Agents](https://img.shields.io/badge/agents-7-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)]()

## Overview

This module provides external coordination tools for managing multiple Antigravity IDE agent conversations. It implements the Gastown MEOW (Mayor-Enhanced Orchestration Workflow) protocol to:

- 🧠 **Monitor** agent brain directories for progress
- 👉 **Poke** idle agents with continuation prompts
- 📊 **Aggregate** results across all workers
- 🏁 **Trigger** Director review when phase completes

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL ORCHESTRATOR                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Brain       │  │ GEMINI.md   │  │ Continuation│  │ Phase       │        │
│  │ Poller      │→ │ Message Bus │→ │ Injector    │→ │ Detector    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         ↓                                                   ↓               │
│  ┌─────────────┐  ┌─────────────┐                   ┌─────────────┐        │
│  │ Artifact    │  │ Walkthrough │                   │ CLI         │        │
│  │ Reader      │  │ Aggregator  │                   │ Dashboard   │        │
│  └─────────────┘  └─────────────┘                   └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓                 ↓                 ↓                 ↓
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Orchestrator│   │   Backend   │   │  Security   │   │     QA      │
│   (Mayor)   │   │  Engineer   │   │  Engineer   │   │  Engineer   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

## Quick Start

### 1. Run the Dashboard (Recommended First Step)

```bash
./scripts/run-dashboard.sh
```

This shows a real-time view of all agent statuses:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              🧠 ANTIGRAVITY MULTI-AGENT COORDINATION DASHBOARD              ║
╚══════════════════════════════════════════════════════════════════════════════╝

  AGENT STATUS MATRIX
  ──────────────────────────────────────────────────────────────────────────
  Agent                Progress                Tasks      Idle       Status
  orchestrator         [█████████░░░░░░░░░░░]  9/16       40m        ⚠️ IDLE
  backend-engineer     [████████████████████]  5/5        -          ✅ DONE
  security-engineer    [█████░░░░░░░░░░░░░░░]  2/6        48m        ⚠️ IDLE
```

### 2. Start the Orchestrator Daemon

```bash
# Start in background
./scripts/orchestrator-daemon.sh start

# Check status
./scripts/orchestrator-daemon.sh status

# View logs
./scripts/orchestrator-daemon.sh logs

# Stop
./scripts/orchestrator-daemon.sh stop
```

### 3. Initialize Phase Tasks

```bash
npx ts-node --transpile-only src/orchestrator/gemini-md-bus.ts
```

This writes the task dispatch queue to `~/.gemini/GEMINI.md` so all agents can see it.

---

## Components

### 1. Brain Poller (`brain-poller.ts`)

Monitors agent brain directories (`~/.gemini/antigravity/brain/<conversation-id>/`) to:

- Parse `task.md` checklists
- Detect idle agents (>60s no activity)
- Calculate completion progress
- Emit events on phase completion

```typescript
import { BrainPoller } from './src/orchestrator';

const poller = new BrainPoller({
  pollingIntervalMs: 30000,
  idleThresholdMs: 60000,
  autoInjectContinuation: true,
  agents: [...],
});

poller.on('agent:complete', (status) => console.log('Agent done:', status.role));
await poller.start();
```

### 2. GEMINI.md Message Bus (`gemini-md-bus.ts`)

Uses `~/.gemini/GEMINI.md` as a shared state store. All agents see the same task queue on wake-up.

```typescript
import { GeminiMdMessageBus } from './src/orchestrator';

const bus = new GeminiMdMessageBus();

// Initialize phase
await bus.initializePhase('phase-2', 'docs/phases/phase-2.md', tasks);

// Update task status
await bus.updateTaskStatus('P2-001', 'complete');

// Get current state
const state = await bus.getOrchestratorState();
```

### 3. Continuation Injector (`antigravity-api.ts`)

Writes `.continuation-prompt` files to agent brain directories to wake idle agents.

```typescript
import { injectViaFile } from './src/orchestrator';

await injectViaFile('conversation-id', {
  agentId: 'backend',
  conversationId: '...',
  prompt: 'Continue with next task: Implement CLI flag',
});
```

### 4. Phase Detector (`phase-detector.ts`)

Monitors workers and triggers Director review when all tasks complete.

```typescript
import { PhaseCompletionDetector } from './src/orchestrator';

const detector = new PhaseCompletionDetector({
  workers: [...],
  directorConversationId: '5c053cb6...',
});

detector.on('phase:complete', (event) => {
  console.log('Phase complete! Notifying Director...');
});

await detector.start();
```

### 5. Artifact Reader (`artifact-reader.ts`)

Reads artifacts from other agents' brain directories.

```typescript
import { ArtifactReader } from './src/orchestrator';

const reader = new ArtifactReader();

// Read all artifacts for an agent
const artifacts = await reader.readAgentArtifacts('conversation-id', 'backend-engineer');
console.log(artifacts.task);       // ParsedTaskMd
console.log(artifacts.walkthrough); // ParsedWalkthrough
console.log(artifacts.implementationPlan); // string

// Generate phase report
const report = await reader.aggregatePhaseReport('phase-2', workers);
```

### 6. Walkthrough Aggregator (`walkthrough-aggregator.ts`)

Combines all worker walkthroughs into a single phase summary with completion certificate.

```typescript
import { WalkthroughAggregator } from './src/orchestrator';

const aggregator = new WalkthroughAggregator();

const summary = await aggregator.aggregatePhaseWalkthroughs(
  'phase-2-context-injection',
  workers
);

// Generates: docs/phase-2-context-injection-walkthrough-summary.md
```

### 7. CLI Dashboard (`dashboard.ts`)

Real-time terminal UI with ANSI colors, progress bars, and GEMINI.md dispatch queue.

```bash
./scripts/run-dashboard.sh
```

---

## File Structure

```
src/orchestrator/
├── index.ts                    # All exports
├── brain-poller.ts             # Agent monitoring
├── antigravity-api.ts          # Continuation injection
├── gemini-md-bus.ts            # Shared state via GEMINI.md
├── phase-detector.ts           # Phase completion detection
├── artifact-reader.ts          # Cross-agent artifact reading
├── dashboard.ts                # CLI dashboard
└── walkthrough-aggregator.ts   # Phase summary generation

scripts/
├── run-brain-poller.sh         # Run poller only
├── run-dashboard.sh            # Run CLI dashboard
├── run-orchestrator.sh         # Run full orchestrator
└── orchestrator-daemon.sh      # Daemon management

config/
└── pm2.config.js               # PM2 process manager config

docs/
├── GASTOWN_PROTOCOL.md         # Protocol specification
├── ANTIGRAVITY_INTERNALS.md    # IDE architecture research
├── PERSISTENT_MULTI_AGENT_COORDINATION.md  # Architecture patterns
├── WAKE_AGENTS.md              # Agent activation commands
├── task-gastown.md             # Implementation task tracker
└── phase-2-*-walkthrough-summary.md  # Generated summaries
```

---

## Agent Configuration

Current agents are defined in `src/orchestrator/index.ts`:

| Agent | Conversation ID | Role |
|-------|-----------------|------|
| Orchestrator | `e20afd38-f5dc-4f4c-aadc-a720cc401eaf` | Mayor 🎩 |
| Backend Engineer | `15b9c503-6ccc-4d27-be08-680a3b9c0af2` | Polecat 🦨 |
| Security Engineer | `64a8119a-82df-466d-b1ef-6a968f8c02f2` | Polecat 🦨 |
| QA Engineer | `5858eac3-c35a-44e1-9b13-8023ddcd423d` | Polecat 🦨 |
| DevOps Engineer | `91ccd3cd-586f-4f0d-b490-7fb42ceed5b2` | Polecat 🦨 |
| Product Manager | `3c6c5553-b9d8-43c9-a6ed-4c85f8abb433` | Polecat 🦨 |
| Engineering Director | `5c053cb6-0934-4f88-9ab9-19aebdecd1a1` | Council 🏛️ |

---

## How It Works

### 1. Initialization

```bash
# 1. Initialize phase tasks in GEMINI.md
npx ts-node --transpile-only src/orchestrator/gemini-md-bus.ts

# 2. Start the orchestrator daemon
./scripts/orchestrator-daemon.sh start
```

### 2. Wake Agents

Copy activation commands from `docs/WAKE_AGENTS.md` into each agent conversation.

### 3. Coordination Loop

```
┌─────────────────────────────────────────────────┐
│ 1. Orchestrator dispatches tasks via GEMINI.md │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Workers read GEMINI.md, see assigned tasks  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Workers update their task.md as they work   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Brain Poller detects idle agents            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Continuation Injector pokes idle agents     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 6. Phase Detector triggers Director review     │
└─────────────────────────────────────────────────┘
```

### 4. Phase Completion

When all worker tasks are complete:
- Phase Detector writes continuation prompt to Director's brain dir
- Walkthrough Aggregator generates phase summary
- Director reviews and approves/vetoes phase

---

## API Reference

### BrainPoller

```typescript
interface OrchestratorConfig {
  pollingIntervalMs: number;      // Default: 30000
  idleThresholdMs: number;        // Default: 60000
  brainBaseDir: string;           // Default: ~/.gemini/antigravity/brain
  agents: AgentConfig[];
  autoInjectContinuation: boolean;
}

interface AgentStatus {
  agentId: string;
  role: string;
  conversationId: string;
  totalTasks: number;
  completedTasks: number;
  isComplete: boolean;
  isIdle: boolean;
  idleDurationMs: number;
}
```

### GeminiMdMessageBus

```typescript
interface TaskDispatch {
  id: string;
  agent: string;
  description: string;
  status: 'pending' | 'dispatched' | 'in_progress' | 'complete';
  storyFile?: string;
  dependencies?: string[];
}

interface OrchestratorState {
  currentPhase: PhaseState;
  heartbeats: AgentHeartbeat[];
  lastOrchestratorPoll: string;
}
```

---

## Troubleshooting

### Agents Not Responding to Pokes

1. Check if `.continuation-prompt` exists in their brain dir:
   ```bash
   cat ~/.gemini/antigravity/brain/<id>/.continuation-prompt
   ```

2. Agents need to be configured to poll for this file (see `docs/WAKE_AGENTS.md`)

### Dashboard Shows 0/0 Tasks

- Agent doesn't have a `task.md` file yet
- Brain directory doesn't exist for that conversation

### Daemon Won't Start

```bash
# Check logs
cat logs/orchestrator.error.log

# Check if already running
./scripts/orchestrator-daemon.sh status
```

---

## References

- [Gastown Protocol](docs/GASTOWN_PROTOCOL.md) - MEOW workflow specification
- [Antigravity Internals](docs/ANTIGRAVITY_INTERNALS.md) - IDE architecture research
- [Wake Agents](docs/WAKE_AGENTS.md) - Agent activation commands
- [Task Tracker](docs/task-gastown.md) - Implementation progress

---

## License

MIT
