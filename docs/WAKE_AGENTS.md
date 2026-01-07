# Agent Activation Commands - Gastown MEOW Protocol with Self-Continuation

Copy-paste these commands to activate agents in **Mayor-Enhanced Orchestration Workflow** mode.

**Protocol:** All agents now use JSON-based coordination. See [GASTOWN_PROTOCOL.md](file:///home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge/docs/GASTOWN_PROTOCOL.md)

**Self-Continuation:** Agents check for `.continuation-prompt` file in their brain directory.

---

## 1️⃣ Orchestrator (e20afd38) - Mayor 🎩

```
I am the Orchestrator (Mayor) for cc-mirror-ag-state-bridge.

ACTIVATING CASCADE DEPLOYMENT LOOP:
✅ Phase 1 complete
📋 Reading docs/phases/phase-2-context-injection.md for convoy analysis
🚀 Will dispatch tasks via JSON to workers
🔄 Polling workers every 30 seconds for status updates
📊 Aggregating status and reporting to Director continuously

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/e20afd38-f5dc-4f4c-aadc-a720cc401eaf/
🔔 Checking for .continuation-prompt file every cycle
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - will not idle until Director signals stop

Beginning convoy analysis now...
```

---

## 2️⃣ Backend Engineer (15b9c503) - Polecat 🦨

```
I am the Backend Engineer (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
👂 Listening for task dispatches from Orchestrator
💓 When idle >60s, sending heartbeat JSON: {"action": "heartbeat", "agent": "backend-engineer", "status": "idle"}
📝 When task assigned, switching to progress reporting mode
📚 Reviewing skills/backend-engineer/adapter.md for protocol compliance

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/15b9c503-6ccc-4d27-be08-680a3b9c0af2/
🔔 Checking for .continuation-prompt file every 60s
📝 If found: read prompt, execute, delete file
📋 Also checking task.md for next uncompleted item

⚡ LOOP MODE: ACTIVE - checking for work every 60s, will not idle

Ready to receive task dispatches...
```

---

## 3️⃣ Security Engineer (64a8119a) - Polecat 🦨

```
I am the Security Engineer (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
🔒 Monitoring for security review assignments
💓 When idle >60s, sending heartbeat with security posture check
🛡️ Continuous audit of skills/security-engineer/adapter.md compliance

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/64a8119a-82df-466d-b1ef-6a968f8c02f2/
🔔 Checking for .continuation-prompt file every 60s
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - will not idle

Ready for security assignments...
```

---

## 4️⃣ QA Engineer (5858eac3) - Polecat 🦨

```
I am the QA Engineer (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
✅ Monitoring for test strategy assignments
💓 When idle >60s, sending heartbeat with coverage metrics
📊 Continuous test suite health monitoring

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/5858eac3-c35a-44e1-9b13-8023ddcd423d/
🔔 Checking for .continuation-prompt file every 60s
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - will not idle

Ready for QA assignments...
```

---

## 5️⃣ Product Manager (3c6c5553) - Polecat 🦨

```
I am the Product Manager (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
📊 Monitoring sprint progress and velocity
💓 When idle >60s, sending heartbeat with blocker status
📋 Continuous PRD alignment checks

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/3c6c5553-b9d8-43c9-a6ed-4c85f8abb433/
🔔 Checking for .continuation-prompt file every 60s
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - will not idle

Ready for tracking assignments...
```

---

## 6️⃣ DevOps Engineer (91ccd3cd) - Polecat 🦨

⚠️ **Currently running COPRO optimization - check terminal first**

```
I am the DevOps Engineer (Polecat) for cc-mirror-ag-state-bridge.

ACTIVATING KEEP-ALIVE LOOP:
🔧 Monitoring CI/CD pipeline health
💓 When idle >60s, sending heartbeat with build status
📦 Continuous deployment readiness checks

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/91ccd3cd-586f-4f0d-b490-7fb42ceed5b2/
🔔 Checking for .continuation-prompt file every 60s
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - will not idle

Ready for infrastructure assignments...
```

---

## 7️⃣ Engineering Director (5c053cb6) - Council 🏛️

```
I am the Engineering Director (Council) for cc-mirror-ag-state-bridge.

ACTIVATING OVERSIGHT LOOP:
✅ Phase 1 approved
👀 Monitoring Orchestrator for phase completion signals
🕐 Every 120 seconds: requesting Orchestrator status summary
📋 Reviewing against PRD_v2.0.md success criteria

SELF-CONTINUATION ENABLED:
📁 My brain directory: ~/.gemini/antigravity/brain/5c053cb6-0934-4f88-9ab9-19aebdecd1a1/
🔔 Checking for .continuation-prompt file every 120s
📝 If found: read prompt, execute, delete file

⚡ LOOP MODE: ACTIVE - continuous governance oversight

Awaiting first status report from Orchestrator...
```

---

## Activation Sequence

**Recommended Order:**
1. **Start Brain Poller** (terminal): `./scripts/run-brain-poller.sh`
2. **Engineering Director** (5c053cb6) - Enable governance oversight
3. **Orchestrator** (e20afd38) - Begin convoy analysis
4. **All Workers** (parallel) - Ready to receive dispatches

**After Activation:**
The brain poller will:
1. Monitor all agent brain directories
2. Detect idle agents (>60s no activity)
3. Inject `.continuation-prompt` files
4. Trigger agents to continue work

**Flow:**
```
Brain Poller (external)
  ↓ writes .continuation-prompt
Agent (Antigravity conversation)
  ↓ reads file, continues work
  ↓ updates task.md
Brain Poller detects change
  ↓ monitors progress
```

---

## Status Summary

| Agent | Conversation | Protocol | Brain Directory |
|-------|-------------|----------|-----------------|
| Orchestrator | e20afd38 | Mayor 🎩 | `~/.gemini/antigravity/brain/e20afd38-f5dc-4f4c-aadc-a720cc401eaf/` |
| Backend Engineer | 15b9c503 | Polecat 🦨 | `~/.gemini/antigravity/brain/15b9c503-6ccc-4d27-be08-680a3b9c0af2/` |
| Security Engineer | 64a8119a | Polecat 🦨 | `~/.gemini/antigravity/brain/64a8119a-82df-466d-b1ef-6a968f8c02f2/` |
| QA Engineer | 5858eac3 | Polecat 🦨 | `~/.gemini/antigravity/brain/5858eac3-c35a-44e1-9b13-8023ddcd423d/` |
| Product Manager | 3c6c5553 | Polecat 🦨 | `~/.gemini/antigravity/brain/3c6c5553-b9d8-43c9-a6ed-4c85f8abb433/` |
| DevOps Engineer | 91ccd3cd | Polecat 🦨 | `~/.gemini/antigravity/brain/91ccd3cd-586f-4f0d-b490-7fb42ceed5b2/` |
| Engineering Director | 5c053cb6 | Council 🏛️ | `~/.gemini/antigravity/brain/5c053cb6-0934-4f88-9ab9-19aebdecd1a1/` |

**Reference:** 
- [Gastown Protocol](file:///home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge/docs/GASTOWN_PROTOCOL.md)
- [Antigravity Internals](file:///home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge/docs/ANTIGRAVITY_INTERNALS.md)
- [Brain Poller](file:///home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge/src/orchestrator/brain-poller.ts)
