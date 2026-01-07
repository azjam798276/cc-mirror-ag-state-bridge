# State Machine for Task Lifecycle

**Source:** https://github.com/nickuraltsev/finity
**Relevance:** Orchestrator - State Machine Implementation

## Code Snippet
```typescript
import Finity from 'finity';

interface TaskContext {
  taskId: string;
  agentId: string;
  payload: any;
  result?: any;
  error?: Error;
  retries: number;
}

class TaskStateMachine {
  static createMachine(context: TaskContext) {
    return Finity
      .configure()
        .initialState('pending')
          .onEnter(() => console.log(`[Task ${context.taskId}] Queued`))
          .on('assign').transitionTo('assigned')

        .state('assigned')
          .onEnter(() => console.log(`[Task ${context.taskId}] Assigned to ${context.agentId}`))
          .on('start').transitionTo('in_progress')
          .on('cancel').transitionTo('cancelled')

        .state('in_progress')
          .onEnter(() => console.log(`[Task ${context.taskId}] Executing...`))
          .do((state, ctx) => this.executeTask(ctx))
            .onSuccess().transitionTo('completed')
            .onFailure().transitionTo('failed')
          .onTimeout(120000) // 2 minute timeout
            .transitionTo('timeout')

        .state('failed')
          .onEnter((state, ctx) => {
            console.error(`[Task ${ctx.taskId}] Failed:`, ctx.error);
          })
          .on('retry')
            .transitionTo('pending')
            .withCondition((ctx) => ctx.retries < 3) // Max 3 retries
          .on('retry')
            .transitionTo('exhausted')
            .withCondition((ctx) => ctx.retries >= 3)

        .state('timeout')
          .onEnter(() => console.log(`[Task ${context.taskId}] Timed out`))
          .on('retry').transitionTo('pending')

        .state('completed')
          .onEnter((state, ctx) => {
            console.log(`[Task ${ctx.taskId}] Completed successfully`);
          })

        .state('cancelled')
          .onEnter(() => console.log(`[Task ${context.taskId}] Cancelled`))

        .state('exhausted')
          .onEnter(() => console.log(`[Task ${context.taskId}] Max retries exhausted`))

        .global()
          .onStateEnter((state) => {
            // Update task status in database
            this.updateTaskStatus(context.taskId, state);
          })
          .onTransition((from, to, ctx) => {
            console.log(`[Task ${ctx.taskId}] ${from} → ${to}`);
          })

      .start();
  }

  private static async executeTask(context: TaskContext): Promise<any> {
    // Execute the actual task
    const result = await performAgentWork(context.agentId, context.payload);
    context.result = result;
    return result;
  }

  private static updateTaskStatus(taskId: string, status: string) {
    // Persist state to database for recovery
  }
}

// Usage in Mayor
class Mayor {
  private activeTasks: Map<string, any> = new Map();

  async dispatchTask(taskId: string, agentId: string, payload: any) {
    const context: TaskContext = {
      taskId,
      agentId,
      payload,
      retries: 0
    };

    const machine = TaskStateMachine.createMachine(context);
    this.activeTasks.set(taskId, machine);

    machine.handle('assign');
    machine.handle('start');

    return machine;
  }

  retryTask(taskId: string) {
    const machine = this.activeTasks.get(taskId);
    if (machine) {
      machine.handle('retry');
    }
  }
}
```

## Why This Works
- Declarative state transitions make workflow logic explicit and testable
- Promise-based triggers (`.do()` with `.onSuccess()`) handle async operations naturally
- Guard conditions (`.withCondition()`) enable smart retry logic
- Global hooks provide centralized logging and persistence
- Timeout handling prevents stuck tasks from blocking the system
