# Task Queue with Concurrency Control

**Source:** https://github.com/joakin/task-queue
**Relevance:** Orchestrator - Task Queue Management

## Code Snippet
```typescript
import { Queue } from "@joakin/task-queue";

interface AgentTask {
  agentId: string;
  action: string;
  payload: any;
}

class MayorOrchestrator {
  private queue: QueueInstance;
  private workerAgents: Map<string, WorkerAgent> = new Map();

  constructor() {
    this.queue = Queue({
      queueTimeout: 30000,      // 30s max wait in queue
      executionTimeout: 120000, // 2min max execution
      concurrency: 3,           // 3 agents can work simultaneously
      maxTaskCount: 50          // Max 50 queued tasks
    });

    // Monitor queue events
    this.queue.on("queue.new", ({ id, inProgressCount, waitingCount }) => {
      console.log(`[Mayor] New task #${id} queued. Active: ${inProgressCount}, Waiting: ${waitingCount}`);
    });

    this.queue.on("job.started", ({ id, addedToTheQueueAt }) => {
      const waitTime = Date.now() - addedToTheQueueAt;
      console.log(`[Mayor] Task #${id} started after ${waitTime}ms wait`);
    });

    this.queue.on("job.success", ({ id, startedProcessingAt }) => {
      const duration = Date.now() - startedProcessingAt;
      console.log(`[Mayor] Task #${id} completed in ${duration}ms`);
    });

    this.queue.on("job.failure", ({ id, err }) => {
      console.error(`[Mayor] Task #${id} failed:`, err);
    });
  }

  async dispatchTask(task: AgentTask): Promise<any> {
    // Add task to queue with cancellation support
    const job = this.queue.add(
      async () => {
        const agent = this.workerAgents.get(task.agentId);
        if (!agent) {
          throw new Error(`Agent ${task.agentId} not found`);
        }
        return await agent.execute(task.action, task.payload);
      },
      () => {
        // Cleanup on cancellation
        console.log(`[Mayor] Task for agent ${task.agentId} cancelled`);
      }
    );

    return job;
  }

  getQueueStats() {
    return this.queue.stats();
    // Returns: { jobs: { total, inProgress, waiting }, full: boolean }
  }

  registerAgent(agentId: string, agent: WorkerAgent) {
    this.workerAgents.set(agentId, agent);
  }
}
```

## Why This Works
- Promise-based API integrates seamlessly with async workflows
- Event emitters enable real-time monitoring without polling
- Concurrency control prevents resource exhaustion when multiple agents work simultaneously
- Timeout configurations ensure tasks don't hang indefinitely
- Cancellation support allows graceful shutdown of long-running operations
