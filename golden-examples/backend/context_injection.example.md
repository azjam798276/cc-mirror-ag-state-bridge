---
id: "context_injection_with_token_budget"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["typescript", "token-management", "context", "llm", "truncation"]
---

## Problem

Need to inject Antigravity session context into Claude Code messages without exceeding API token limits (200K for Claude 3.5 Sonnet). Large sessions with 50+ steps could generate 75K+ tokens of context, consuming user's quota and potentially hitting limits.

## Solution

```typescript
export interface ParsedSession {
  sessionId: string;
  goal: string;
  planSteps: PlanStep[];
  currentStep: number;
  completedSteps: PlanStep[];
  pendingSteps: PlanStep[];
  filesModified: string[];
  variables: Record<string, any>;
  terminalHistory: string[];
  errors: string[];
}

export interface PlanStep {
  id: string;
  action: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  artifacts: string[];
  output?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

export interface ContextInjectionOptions {
  maxTokens?: number;
  truncateSteps?: boolean;
  includeVariables?: boolean;
  includeTerminalHistory?: boolean;
}

/**
 * Builds and injects Antigravity session context into message arrays.
 * Implements smart truncation to stay within token budgets.
 */
export class ContextInjector {
  // Conservative token estimate: ~4 chars per token
  private readonly CHARS_PER_TOKEN = 4;
  
  // Default budget: ~10K tokens = 40K chars
  private readonly DEFAULT_MAX_TOKENS = 10000;

  constructor(private options: ContextInjectionOptions = {}) {}

  /**
   * Build a context message from parsed session data.
   * Automatically truncates if content would exceed token budget.
   */
  buildContextMessage(session: ParsedSession): string {
    const maxTokens = this.options.maxTokens ?? this.DEFAULT_MAX_TOKENS;
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;

    const sections: string[] = [];
    let totalChars = 0;

    // ===== ALWAYS INCLUDE (Core Context) =====

    const header = this.buildHeader(session);
    sections.push(header);
    totalChars += header.length;

    const goal = this.buildGoalSection(session);
    sections.push(goal);
    totalChars += goal.length;

    const progress = this.buildProgressSection(session);
    sections.push(progress);
    totalChars += progress.length;

    // ===== CONDITIONALLY INCLUDE (Budget-Aware) =====

    const remainingChars = maxChars - totalChars;

    // Completed steps (with truncation if needed)
    const completed = this.buildCompletedSteps(session, remainingChars * 0.5);
    sections.push(completed);
    totalChars += completed.length;

    // Pending steps (summarized if many)
    const pending = this.buildPendingSteps(
      session,
      this.options.truncateSteps ?? true
    );
    sections.push(pending);
    totalChars += pending.length;

    // Files (usually small, always include)
    const files = this.buildFilesSection(session);
    sections.push(files);
    totalChars += files.length;

    // Variables (optional, can be verbose)
    if (this.options.includeVariables !== false && Object.keys(session.variables).length > 0) {
      const varsChars = maxChars - totalChars;
      if (varsChars > 1000) { // Only if we have room
        const vars = this.buildVariablesSection(session, varsChars);
        sections.push(vars);
        totalChars += vars.length;
      }
    }

    // Terminal history (optional, often verbose)
    if (this.options.includeTerminalHistory && session.terminalHistory.length > 0) {
      const termChars = maxChars - totalChars;
      if (termChars > 500) {
        const term = this.buildTerminalSection(session, termChars);
        sections.push(term);
      }
    }

    // Warning if we had to truncate
    if (totalChars > maxChars) {
      sections.push('\n⚠️ *Note: Context was truncated due to size limits.*');
    }

    return sections.join('\n\n');
  }

  /**
   * Inject context as a system message at the start of the conversation.
   */
  injectContext(messages: Message[], session: ParsedSession): Message[] {
    const contextContent = this.buildContextMessage(session);

    const contextMessage: Message = {
      role: 'system',
      content: contextContent,
      metadata: {
        source: 'antigravity-session',
        sessionId: session.sessionId,
        injectedAt: new Date().toISOString(),
        estimatedTokens: Math.ceil(contextContent.length / this.CHARS_PER_TOKEN)
      }
    };

    // Prepend to message array
    return [contextMessage, ...messages];
  }

  // ========== SECTION BUILDERS ==========

  private buildHeader(session: ParsedSession): string {
    const timestamp = new Date().toISOString();
    return `# 🔄 CONTINUING FROM ANTIGRAVITY SESSION

**Session ID:** ${session.sessionId}  
**Loaded at:** ${timestamp}`;
  }

  private buildGoalSection(session: ParsedSession): string {
    return `## Original Goal

${session.goal}`;
  }

  private buildProgressSection(session: ParsedSession): string {
    const completed = session.completedSteps.length;
    const total = session.planSteps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return `## Progress Summary

**${completed}/${total} steps completed (${percentage}%)**`;
  }

  private buildCompletedSteps(session: ParsedSession, maxChars: number): string {
    if (session.completedSteps.length === 0) {
      return '## Completed Steps\n\n*No steps completed yet.*';
    }

    const lines: string[] = ['## Completed Steps\n'];
    let charsUsed = lines.length;

    for (let i = 0; i < session.completedSteps.length; i++) {
      const step = session.completedSteps[i];
      
      // Build step line
      let stepText = `${i + 1}. ✅ **${step.action}**`;
      
      // Add artifacts if present and space permits
      if (step.artifacts.length > 0) {
        const artifactsText = `\n   *Files: ${step.artifacts.join(', ')}*`;
        const projectedChars = charsUsed + stepText.length + artifactsText.length;
        
        if (projectedChars < maxChars) {
          stepText += artifactsText;
        }
      }

      // Check if we can fit this step
      if (charsUsed + stepText.length > maxChars) {
        const remaining = session.completedSteps.length - i;
        lines.push(`\n*... (${remaining} more steps omitted to save space)*`);
        break;
      }

      lines.push(stepText);
      charsUsed += stepText.length;
    }

    return lines.join('\n');
  }

  private buildPendingSteps(session: ParsedSession, summarize: boolean): string {
    if (session.pendingSteps.length === 0) {
      return '## Pending Steps\n\n*All steps completed!*';
    }

    // If many pending steps and summarization enabled, show summary
    if (summarize && session.pendingSteps.length > 10) {
      const next = session.pendingSteps[0];
      const upcoming = session.pendingSteps.slice(1, 4).map(s => s.action);
      const remaining = session.pendingSteps.length - 4;

      return `## Pending Steps (${session.pendingSteps.length} remaining)

**Next:** 🔄 ${next.action}

**Upcoming:**
${upcoming.map((action, i) => `${i + 1}. ⧗ ${action}`).join('\n')}

*... and ${remaining} more steps*`;
    }

    // Normal list for reasonable number of steps
    const lines = ['## Pending Steps\n'];
    
    session.pendingSteps.forEach((step, i) => {
      const icon = i === 0 ? '🔄' : '⧗';
      lines.push(`${i + 1}. ${icon} **${step.action}**`);
    });

    return lines.join('\n');
  }

  private buildFilesSection(session: ParsedSession): string {
    if (session.filesModified.length === 0) {
      return '## Files Modified by Antigravity\n\n*No files modified yet.*';
    }

    const fileList = session.filesModified
      .slice(0, 20) // Show max 20 files
      .map(f => `- \`${f}\``)
      .join('\n');

    const remaining = session.filesModified.length - 20;
    const more = remaining > 0 ? `\n\n*... and ${remaining} more files*` : '';

    return `## Files Modified by Antigravity

${fileList}${more}`;
  }

  private buildVariablesSection(session: ParsedSession, maxChars: number): string {
    const varsJson = JSON.stringify(session.variables, null, 2);
    
    if (varsJson.length > maxChars) {
      // Truncate JSON if too large
      const truncated = varsJson.slice(0, maxChars - 50);
      return `## Session Variables

\`\`\`json
${truncated}
... (truncated)
\`\`\``;
    }

    return `## Session Variables

\`\`\`json
${varsJson}
\`\`\``;
  }

  private buildTerminalSection(session: ParsedSession, maxChars: number): string {
    const commands = session.terminalHistory.slice(-10); // Last 10 commands
    const commandText = commands.map(cmd => `$ ${cmd}`).join('\n');

    if (commandText.length > maxChars) {
      return '## Recent Terminal Commands\n\n*(omitted due to size)*';
    }

    return `## Recent Terminal Commands

\`\`\`bash
${commandText}
\`\`\``;
  }
}

// Usage Example:
async function example() {
  const session: ParsedSession = {
    sessionId: 'abc123',
    goal: 'Build REST API with authentication',
    planSteps: [
      { id: '1', action: 'Design schema', status: 'completed', artifacts: ['schema.sql'] },
      { id: '2', action: 'Implement models', status: 'completed', artifacts: ['user.ts'] },
      { id: '3', action: 'Add auth middleware', status: 'executing', artifacts: [] },
      { id: '4', action: 'Write tests', status: 'pending', artifacts: [] }
    ],
    currentStep: 2,
    completedSteps: [],
    pendingSteps: [],
    filesModified: ['schema.sql', 'user.ts'],
    variables: { DB_NAME: 'myapp' },
    terminalHistory: ['npm install', 'npm run migrate'],
    errors: []
  };

  const injector = new ContextInjector({
    maxTokens: 10000,
    truncateSteps: true,
    includeVariables: true
  });

  const contextMsg = injector.buildContextMessage(session);
  console.log(contextMsg);
  console.log(`\nEstimated tokens: ${Math.ceil(contextMsg.length / 4)}`);
}
```

## Key Techniques

- **Token budgeting**: Use `maxTokens` parameter to enforce hard limits. Conservative estimate of 4 chars/token prevents over-budget injection.

- **Priority-based inclusion**: Core context (goal, progress) always included. Optional context (variables, terminal) only if space permits.

- **Progressive truncation**: Completed steps are truncated first (show N, then "... X more omitted"). Pending steps are summarized (show next 3, count rest).

- **Character-based estimation**: Track `totalChars` during build rather than tokens. Faster than calling tiktoken and sufficiently accurate for budgeting.

- **Metadata attachment**: The injected message includes `estimatedTokens` in metadata for telemetry and debugging.

- **Graceful omission**: If a section won't fit, it's simply skipped with no error. Better to have partial context than fail.

- **Format consistency**: All sections use markdown with emoji icons (✅, 🔄, ⧗) for visual clarity when rendered.

## References

- [Claude Token Limits](https://docs.anthropic.com/claude/reference/errors-and-rate-limits) - API constraints
- [Token Estimation Strategies](https://help.openai.com/en/articles/4936856-what-are-tokens) - Counting approaches
- [Progressive Enhancement](https://en.wikipedia.org/wiki/Progressive_enhancement) - Layered context strategy
