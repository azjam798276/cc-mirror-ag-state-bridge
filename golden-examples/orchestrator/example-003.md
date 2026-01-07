# Multi-Agent Task Coordinator

**Source:** https://gist.github.com/lilBunnyRabbit/8ba9a800b7cf9f91df84e15e9a2d6faa
**Relevance:** Orchestrator - Task Dispatch & Progress Tracking

## Code Snippet
```typescript
import { TaskManager, createTask, Task } from "./TaskManager";

// Define task types for different agents
const CodeGenTask = createTask<{ prompt: string }, { code: string }>({
  name: "Code Generation",
  
  parse() {
    switch (this.status) {
      case "idle":
        return { status: `Queued: ${this.data.prompt}` };
      case "in-progress":
        return { status: "Generating code..." };
      case "success":
        return { 
          status: "✅ Code generated",
          result: this.result.get()?.code.slice(0, 100) + "..."
        };
      case "error":
        return { status: "❌ Generation failed", errors: this.errors };
    }
  },

  async execute(data) {
    // Call code generation agent
    const response = await fetch("http://agent-codegen:3000/generate", {
      method: "POST",
      body: JSON.stringify(data)
    });
    
    const code = await response.json();
    
    // Update progress
    this.setProgress(0.5);
    
    return { code };
  }
});

const TestGenTask = createTask<{ code: string }, { tests: string }>({
  name: "Test Generation",
  
  async execute(data) {
    // Get code from previous task
    const codeResult = this.manager.getLastTaskResult(CodeGenTask);
    
    const response = await fetch("http://agent-testgen:3000/generate", {
      method: "POST",
      body: JSON.stringify({ code: codeResult.code })
    });
    
    return await response.json();
  }
});

const ReviewTask = createTask<void, { approved: boolean }>({
  name: "Code Review",
  
  async execute() {
    const code = this.manager.getLastTaskResult(CodeGenTask);
    const tests = this.manager.getLastTaskResult(TestGenTask);
    
    const response = await fetch("http://agent-reviewer:3000/review", {
      method: "POST",
      body: JSON.stringify({ code, tests })
    });
    
    return await response.json();
  }
});

// Mayor orchestrator
class MayorOrchestrator {
  private taskManager: TaskManager;

  constructor() {
    this.taskManager = new TaskManager((manager) => {
      // Enable parallel execution for independent tasks
      manager.addFlag(TaskManager.Flag.PARALLEL_EXECUTION);
      
      // Continue even if some tasks fail
      manager.removeFlag(TaskManager.Flag.FAIL_ON_ERROR);
    });

    // Monitor progress
    this.taskManager.on("progress", (progress) => {
      console.log(`[Mayor] Overall progress: ${(progress * 100).toFixed(0)}%`);
    });

    this.taskManager.on("task", (task: Task) => {
      console.log(`[Mayor] Started task: ${task.name}`);
    });

    this.taskManager.on("success", () => {
      console.log("[Mayor] All tasks completed successfully");
      this.generateReport();
    });

    this.taskManager.on("fail", ({ task, error }) => {
      console.error(`[Mayor] Task ${task.name} failed:`, error);
    });
  }

  async executePhase(prompt: string) {
    // Add tasks in dependency order
    this.taskManager.addTasks([
      CodeGenTask({ prompt }),
      TestGenTask({ code: "" }), // Will retrieve from CodeGenTask
      ReviewTask()
    ]);

    await this.taskManager.start();
  }

  private generateReport() {
    const tasks = this.taskManager.tasks;
    
    console.log("\n=== Phase Completion Report ===");
    tasks.forEach(task => {
      const parsed = task.parse();
      console.log(`${task.name}: ${parsed.status}`);
      if (parsed.warnings?.length) {
        console.log(`  Warnings: ${parsed.warnings.join(", ")}`);
      }
    });
  }

  getPhaseStatus() {
    return {
      status: this.taskManager.status,
      progress: this.taskManager.progress,
      tasks: this.taskManager.tasks.map(t => t.parse())
    };
  }
}
```

## Why This Works
- Task dependencies are explicit via `getLastTaskResult()` - no hidden coupling
- Progress tracking is automatic via event emitters
- Parallel execution flag enables concurrent agent work when possible
- Parse methods provide UI-ready status representations
- Manager flags control error handling behavior (fail-fast vs continue)
