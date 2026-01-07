# JSON Protocol for Agent Communication

**Source:** Multi-Agent Systems ADK TypeScript (https://adk.iqai.com/docs/framework/agents/multi-agents)
**Relevance:** Orchestrator - JSON-based Task Dispatch Protocol

## Code Snippet
```typescript
// Standardized message protocol
interface AgentMessage {
  messageId: string;
  timestamp: string;
  from: string;
  to: string;
  type: "task_dispatch" | "task_result" | "status_update" | "error";
  payload: any;
  metadata?: {
    priority?: number;
    parentTaskId?: string;
    deadline?: string;
  };
}

interface TaskDispatchPayload {
  taskId: string;
  action: string;
  parameters: Record<string, any>;
  context: {
    phaseId: string;
    previousResults?: any[];
  };
}

interface TaskResultPayload {
  taskId: string;
  status: "success" | "failure";
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics: {
    startTime: string;
    endTime: string;
    duration: number;
  };
}

class MayorProtocolHandler {
  private messageQueue: AgentMessage[] = [];

  // Dispatch task to agent
  dispatchTask(
    agentId: string,
    taskId: string,
    action: string,
    parameters: any,
    phaseId: string
  ): AgentMessage {
    const message: AgentMessage = {
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      from: "mayor",
      to: agentId,
      type: "task_dispatch",
      payload: {
        taskId,
        action,
        parameters,
        context: {
          phaseId,
          previousResults: this.getPreviousResults(phaseId)
        }
      } as TaskDispatchPayload,
      metadata: {
        priority: this.calculatePriority(action),
        deadline: this.calculateDeadline(action)
      }
    };

    // Send to agent via HTTP/WebSocket/Message Queue
    this.sendMessage(agentId, message);
    
    return message;
  }

  // Handle result from agent
  handleTaskResult(message: AgentMessage) {
    const payload = message.payload as TaskResultPayload;
    
    console.log(`[Mayor] Task ${payload.taskId} completed in ${payload.metrics.duration}ms`);

    if (payload.status === "success") {
      // Store result for dependent tasks
      this.storeTaskResult(payload.taskId, payload.result);
      
      // Check if phase is complete
      this.checkPhaseCompletion(payload.taskId);
    } else {
      // Handle failure
      this.handleTaskFailure(payload.taskId, payload.error!);
    }
  }

  // Parse status update from agent
  handleStatusUpdate(message: AgentMessage) {
    const { taskId, progress, currentStep } = message.payload;
    
    console.log(`[Mayor] Task ${taskId}: ${progress}% - ${currentStep}`);
    
    // Update UI/dashboard
    this.updateTaskProgress(taskId, progress);
  }

  private async sendMessage(agentId: string, message: AgentMessage) {
    const agentUrl = this.getAgentUrl(agentId);
    
    await fetch(`${agentUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message)
    });
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePriority(action: string): number {
    // Higher priority for critical tasks
    const priorities: Record<string, number> = {
      "security_scan": 10,
      "code_review": 8,
      "code_generation": 5,
      "documentation": 3
    };
    return priorities[action] || 5;
  }

  private calculateDeadline(action: string): string {
    // Deadlines based on task type
    const timeouts: Record<string, number> = {
      "code_generation": 5 * 60 * 1000,  // 5 min
      "code_review": 3 * 60 * 1000,       // 3 min
      "test_generation": 10 * 60 * 1000   // 10 min
    };
    
    const timeout = timeouts[action] || 5 * 60 * 1000;
    return new Date(Date.now() + timeout).toISOString();
  }
}
```

## Why This Works
- Standardized message format enables any agent to communicate
- Metadata fields (priority, deadline) enable smart scheduling
- Context passing avoids agents needing to query for dependencies
- Typed payloads ensure compile-time safety with TypeScript
- Metrics in results enable performance monitoring
