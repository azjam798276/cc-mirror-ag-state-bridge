# Perplexity AI Prompt: Golden Examples for Multi-Agent Orchestration

## Context
I'm building a Gastown-style multi-agent system with two key roles:
1. **Orchestrator (MAYOR)**: Continuously monitors project phases, dispatches tasks to worker agents, and tracks completion.
2. **Engineering Director**: Reviews completed phases, approves transitions, and provides strategic guidance.

## Request
Please find **production-quality code examples** from GitHub and StackOverflow that demonstrate:

### For Orchestrator (MAYOR):
1. **Task queue management** patterns in TypeScript/Node.js for multi-agent systems
2. **Workflow orchestration** examples (similar to Temporal, Bull, or BullMQ)
3. **State machine implementations** for tracking task lifecycle (pending → in-progress → complete)
4. **JSON-based task dispatch** protocols between coordinator and worker agents
5. **Phase document parsing** - reading markdown task tables and updating status

### For Engineering Director:
1. **Code review automation** patterns in CI/CD pipelines
2. **Quality gate implementations** checking coverage thresholds (≥90%)
3. **Phase transition approval workflows** in project management systems
4. **Structured decision output** (JSON approval/rejection with reasoning)
5. **Risk assessment** checklists for software releases

## Preferred Sources
- **GitHub**: Look for repos with 100+ stars implementing orchestration patterns
- **StackOverflow**: Highly-voted answers about task coordination, workflow engines

## Output Format
For each example, provide:
```markdown
### Example #N: [Title]
**Source:** [GitHub/SO URL]
**Relevance:** [Which role it applies to]

**Code Snippet:**
```typescript
// Key code demonstrating the pattern
```

**Why This Works:**
[Brief explanation of why this is a good pattern]
```

## Technology Stack
- Node.js 18+
- TypeScript 5.x
- No external workflow engine required (prefer lightweight patterns)
