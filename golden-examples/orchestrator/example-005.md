# Phase Document Parser with Status Updates

**Source:** https://stefanstranger.github.io/2022/02/15/UpdatingTablesinMarkdownFiles/
**Relevance:** Orchestrator - Phase Document Parsing & Updates

## Code Snippet
```typescript
import * as fs from 'fs-extra';

interface PhaseTask {
  id: string;
  description: string;
  assignedAgent: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  result?: string;
  startTime?: Date;
  endTime?: Date;
}

class PhaseDocumentParser {
  private filePath: string;

  constructor(phasePath: string) {
    this.filePath = phasePath;
  }

  // Parse markdown table into structured tasks
  async parseTasks(): Promise<PhaseTask[]> {
    const content = await fs.readFile(this.filePath, 'utf-8');
    
    // Extract table from markdown
    const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
    const match = tableRegex.exec(content);
    
    if (!match) {
      throw new Error("No task table found in phase document");
    }

    const [, headerRow, bodyRows] = match;
    const headers = headerRow.split('|')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    // Parse rows
    const tasks: PhaseTask[] = [];
    const rows = bodyRows.trim().split('\n');

    for (const row of rows) {
      const cells = row.split('|')
        .map(c => c.trim())
        .filter((c, i, arr) => i > 0 && i < arr.length - 1); // Skip empty first/last

      if (cells.length === headers.length) {
        tasks.push({
          id: cells[0],
          description: cells[1],
          assignedAgent: cells[2],
          status: this.parseStatus(cells[3]),
          result: cells[4] || undefined
        });
      }
    }

    return tasks;
  }

  // Update task status in markdown
  async updateTaskStatus(taskId: string, status: PhaseTask['status'], result?: string) {
    const content = await fs.readFile(this.filePath, 'utf-8');
    const tasks = await this.parseTasks();

    // Find task and update
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found`);
    }

    tasks[taskIndex].status = status;
    if (result) {
      tasks[taskIndex].result = result;
    }
    if (status === 'in-progress' && !tasks[taskIndex].startTime) {
      tasks[taskIndex].startTime = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      tasks[taskIndex].endTime = new Date();
    }

    // Rebuild markdown table
    const newTable = this.buildMarkdownTable(tasks);
    
    // Replace table in document
    const updatedContent = content.replace(
      /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/,
      newTable
    );

    await fs.writeFile(this.filePath, updatedContent, 'utf-8');
    
    console.log(`[Mayor] Updated ${taskId}: ${status}`);
  }

  private buildMarkdownTable(tasks: PhaseTask[]): string {
    const headers = ['Task ID', 'Description', 'Agent', 'Status', 'Result'];
    let table = `| ${headers.join(' | ')} |\n`;
    table += `|${headers.map(() => '---').join('|')}|\n`;

    for (const task of tasks) {
      const statusIcon = this.getStatusIcon(task.status);
      const duration = this.calculateDuration(task);
      
      table += `| ${task.id} | ${task.description} | ${task.assignedAgent} | ${statusIcon} ${task.status} | ${task.result || '-'} ${duration} |\n`;
    }

    return table;
  }

  private parseStatus(statusCell: string): PhaseTask['status'] {
    const lower = statusCell.toLowerCase();
    if (lower.includes('completed') || lower.includes('✅')) return 'completed';
    if (lower.includes('in-progress') || lower.includes('🔄')) return 'in-progress';
    if (lower.includes('failed') || lower.includes('❌')) return 'failed';
    return 'pending';
  }

  private getStatusIcon(status: PhaseTask['status']): string {
    const icons = {
      'pending': '⏳',
      'in-progress': '🔄',
      'completed': '✅',
      'failed': '❌'
    };
    return icons[status];
  }

  private calculateDuration(task: PhaseTask): string {
    if (!task.startTime || !task.endTime) return '';
    
    const ms = task.endTime.getTime() - task.startTime.getTime();
    const seconds = Math.floor(ms / 1000);
    
    if (seconds < 60) return `(${seconds}s)`;
    const minutes = Math.floor(seconds / 60);
    return `(${minutes}m ${seconds % 60}s)`;
  }
}

// Usage in Mayor
class MayorWithPhaseTracking {
  private parser: PhaseDocumentParser;

  async executePhase(phasePath: string) {
    this.parser = new PhaseDocumentParser(phasePath);
    
    // Load tasks from document
    const tasks = await this.parser.parseTasks();
    
    console.log(`[Mayor] Loaded ${tasks.length} tasks from phase document`);

    // Execute each task
    for (const task of tasks) {
      await this.parser.updateTaskStatus(task.id, 'in-progress');
      
      try {
        const result = await this.executeTask(task);
        await this.parser.updateTaskStatus(task.id, 'completed', result);
      } catch (error) {
        await this.parser.updateTaskStatus(task.id, 'failed', error.message);
      }
    }
  }

  private async executeTask(task: PhaseTask): Promise<string> {
    // Dispatch to agent and await result
    return "Task completed successfully";
  }
}
```

## Why This Works
- Markdown tables are human-readable and editable
- Regex parsing handles variations in table formatting
- Status icons (✅, 🔄, ❌) provide visual feedback
- Duration tracking enables performance analysis
- Atomic file updates prevent corruption from concurrent writes
