---
id: "resilient_json_parser_with_fallback"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["typescript", "json", "parsing", "resilience", "versioning"]
---

## Problem

Antigravity IDE's session format may change between versions without notice. Need to parse sessions reliably even when format evolves, with graceful degradation to extract whatever information is available rather than failing completely.

## Solution

```typescript
import * as fs from 'fs-extra';
import * as crypto from 'crypto';

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
  timestamp?: Date;
}

export class SessionParseError extends Error {
  constructor(message: string, public readonly filePath: string) {
    super(message);
    this.name = 'SessionParseError';
  }
}

/**
 * Format detector interface for version-specific parsers.
 */
interface FormatDetector {
  version: string;
  detect: (raw: any) => boolean;
  parse: (raw: any) => ParsedSession;
}

/**
 * Resilient session parser with multi-version support and generic fallback.
 * Implements the Chain of Responsibility pattern for format detection.
 */
export class SessionParser {
  private readonly formatDetectors: FormatDetector[] = [];
  private readonly maxFileSize: number = 50 * 1024 * 1024; // 50MB
  private readonly maxDepth: number = 5; // For recursive field search

  constructor() {
    this.registerBuiltInFormats();
  }

  /**
   * Parse an AG session file with automatic format detection.
   * Throws SessionParseError if file is completely unreadable.
   */
  async parse(filePath: string): Promise<ParsedSession> {
    // Safety check: file size limit
    const stats = await fs.stat(filePath);
    if (stats.size > this.maxFileSize) {
      throw new SessionParseError(
        `Session file too large: ${stats.size} bytes (max: ${this.maxFileSize})`,
        filePath
      );
    }

    // Read and parse JSON
    let raw: any;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new SessionParseError(
          `Invalid JSON in session file: ${error instanceof Error ? error.message : String(error)}`,
          filePath
        );
      }
      throw error;
    }

    // Try each registered format detector in order
    for (const detector of this.formatDetectors) {
      if (detector.detect(raw)) {
        console.debug(`[SessionParser] Detected format: ${detector.version}`);
        return detector.parse(raw);
      }
    }

    // No known format matched - use generic heuristic parser
    console.warn('[SessionParser] Unknown format, using generic parser');
    return this.parseGeneric(raw, filePath);
  }

  /**
   * Register a custom format detector (useful for testing or extensions).
   */
  registerFormat(detector: FormatDetector): void {
    this.formatDetectors.unshift(detector); // New formats checked first
  }

  // ========== PRIVATE: FORMAT DETECTORS ==========

  private registerBuiltInFormats(): void {
    // Format V1 (hypothetical - based on AG Beta)
    this.formatDetectors.push({
      version: 'v1',
      detect: (raw) => {
        return (
          raw &&
          typeof raw === 'object' &&
          'plan' in raw &&
          'initialPrompt' in raw &&
          'executionState' in raw
        );
      },
      parse: (raw) => this.parseV1(raw)
    });

    // Format V2 (future-proofing)
    this.formatDetectors.push({
      version: 'v2',
      detect: (raw) => {
        return (
          raw &&
          typeof raw === 'object' &&
          'agentPlan' in raw &&
          'sessionMetadata' in raw
        );
      },
      parse: (raw) => this.parseV2(raw)
    });
  }

  private parseV1(raw: any): ParsedSession {
    // Extract plan steps
    const planSteps: PlanStep[] = (raw.plan?.steps || []).map((step: any) => ({
      id: step.id || step.stepId || crypto.randomUUID(),
      action: step.description || step.action || step.title || 'Unknown action',
      status: this.normalizeStatus(step.status),
      artifacts: Array.isArray(step.files) ? step.files : 
                 Array.isArray(step.artifacts) ? step.artifacts : [],
      output: step.result || step.output,
      timestamp: step.timestamp ? new Date(step.timestamp) : undefined
    }));

    const currentIdx = raw.executionState?.currentStep || 0;

    // Categorize steps by status
    const completedSteps = planSteps.filter(s => s.status === 'completed');
    const pendingSteps = planSteps.filter(
      s => s.status === 'pending' || s.status === 'executing'
    );

    // Extract modified files from steps
    const filesModified = this.extractFilesFromSteps(planSteps);

    return {
      sessionId: raw.sessionId || raw.id || 'unknown',
      goal: raw.initialPrompt || raw.goal || raw.task || 'Unknown goal',
      planSteps,
      currentStep: Math.min(currentIdx, planSteps.length - 1),
      completedSteps,
      pendingSteps,
      filesModified,
      variables: raw.executionState?.variables || raw.variables || {},
      terminalHistory: Array.isArray(raw.terminalHistory) ? raw.terminalHistory : [],
      errors: Array.isArray(raw.errors) ? raw.errors : []
    };
  }

  private parseV2(raw: any): ParsedSession {
    // V2 format (hypothetical future structure)
    const planSteps: PlanStep[] = (raw.agentPlan?.tasks || []).map((task: any) => ({
      id: task.taskId,
      action: task.description,
      status: this.normalizeStatus(task.state),
      artifacts: task.outputFiles || [],
      output: task.executionResult,
      timestamp: task.completedAt ? new Date(task.completedAt) : undefined
    }));

    return {
      sessionId: raw.sessionMetadata?.id || 'unknown',
      goal: raw.sessionMetadata?.objective || 'Unknown goal',
      planSteps,
      currentStep: raw.sessionMetadata?.currentTaskIndex || 0,
      completedSteps: planSteps.filter(s => s.status === 'completed'),
      pendingSteps: planSteps.filter(s => s.status !== 'completed'),
      filesModified: this.extractFilesFromSteps(planSteps),
      variables: raw.context || {},
      terminalHistory: [],
      errors: []
    };
  }

  private parseGeneric(raw: any, filePath: string): ParsedSession {
    // Heuristic extraction when format is completely unknown
    console.warn(`[SessionParser] Attempting generic parse of ${filePath}`);

    const sessionId = this.findFieldInObject(
      raw,
      ['sessionId', 'id', 'session_id', 'sid'],
      0
    ) || 'unknown';

    const goal = this.findFieldInObject(
      raw,
      ['goal', 'task', 'prompt', 'initialPrompt', 'request', 'objective'],
      0
    ) || 'Unknown goal (could not parse session format)';

    const planSteps = this.extractStepsGeneric(raw);
    const filesModified = this.extractFilesGeneric(raw);

    return {
      sessionId,
      goal,
      planSteps,
      currentStep: 0,
      completedSteps: [],
      pendingSteps: planSteps,
      filesModified,
      variables: this.findFieldInObject(raw, ['variables', 'state', 'context'], 0) || {},
      terminalHistory: [],
      errors: [`Warning: Unknown session format, some data may be missing`]
    };
  }

  // ========== PRIVATE: HELPER METHODS ==========

  /**
   * Recursively search object for fields matching one of the given keys.
   * Depth-limited to prevent performance issues on deeply nested structures.
   */
  private findFieldInObject(
    obj: any,
    keys: string[],
    depth: number
  ): any {
    // Base case: exceeded max depth
    if (depth > this.maxDepth) {
      return null;
    }

    // Not an object
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Check direct properties
    for (const key of keys) {
      if (key in obj && obj[key] !== null && obj[key] !== undefined) {
        return obj[key];
      }
    }

    // Recursively check nested objects
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const result = this.findFieldInObject(value, keys, depth + 1);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  private extractStepsGeneric(raw: any): PlanStep[] {
    // Look for array fields that might contain steps
    const stepArrays = this.findFieldInObject(
      raw,
      ['steps', 'tasks', 'plan', 'actions', 'items'],
      0
    );

    if (!Array.isArray(stepArrays)) {
      return [];
    }

    return stepArrays.map((item: any, index: number) => ({
      id: item.id || item.stepId || item.taskId || `step-${index}`,
      action: item.action || item.description || item.title || 'Unknown action',
      status: 'pending' as const,
      artifacts: [],
      output: undefined,
      timestamp: undefined
    }));
  }

  private extractFilesGeneric(raw: any): string[] {
    const files = new Set<string>();

    // Recursively find array fields containing file paths
    const searchForFiles = (obj: any, depth: number) => {
      if (depth > this.maxDepth || !obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        // Look for keys suggesting file lists
        if (/file|artifact|output|modified/i.test(key) && Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'string' && item.length > 0) {
              files.add(item);
            }
          });
        }

        // Recurse
        if (typeof value === 'object') {
          searchForFiles(value, depth + 1);
        }
      }
    };

    searchForFiles(raw, 0);
    return Array.from(files);
  }

  private extractFilesFromSteps(steps: PlanStep[]): string[] {
    const files = new Set<string>();
    
    steps.forEach(step => {
      step.artifacts.forEach(file => files.add(file));
    });

    return Array.from(files);
  }

  private normalizeStatus(status: any): PlanStep['status'] {
    if (!status || typeof status !== 'string') {
      return 'pending';
    }

    const normalized = status.toLowerCase().trim();

    // Completed states
    if (['complete', 'completed', 'done', 'success', 'finished'].includes(normalized)) {
      return 'completed';
    }

    // Executing states
    if (['running', 'executing', 'in_progress', 'active', 'current'].includes(normalized)) {
      return 'executing';
    }

    // Failed states
    if (['failed', 'error', 'cancelled', 'aborted'].includes(normalized)) {
      return 'failed';
    }

    // Default
    return 'pending';
  }
}

// Usage Example:
async function example() {
  const parser = new SessionParser();

  try {
    const session = await parser.parse('/path/to/session.json');
    console.log(`Parsed session: ${session.goal}`);
    console.log(`Progress: ${session.completedSteps.length}/${session.planSteps.length}`);
  } catch (error) {
    if (error instanceof SessionParseError) {
      console.error(`Parse failed: ${error.message}`);
    } else {
      throw error;
    }
  }
}
```

## Key Techniques

- **Chain of Responsibility**: Format detectors are tried in order until one succeeds. New formats can be registered without modifying existing code.

- **Depth-limited recursion**: The `findFieldInObject` method has a `maxDepth` parameter to prevent stack overflow on pathological JSON structures (e.g., circular references or 100+ levels deep).

- **Graceful degradation**: If no known format matches, the generic parser extracts whatever it can using heuristics. Better to return partial data than throw an error.

- **Status normalization**: Different versions might use "completed" vs "done" vs "finished". The `normalizeStatus` method maps variations to a canonical set.

- **Size limits**: Refuse to parse files >50MB to prevent memory exhaustion. This is a hard limit for MVP; streaming parser can be added later if needed.

- **Defensive extraction**: Use optional chaining (`?.`) and nullish coalescing (`||`) extensively. Assume fields might be missing or renamed.

- **Set-based deduplication**: Use `Set<string>` when collecting files to automatically handle duplicates across multiple steps.

## References

- [Chain of Responsibility Pattern](https://refactoring.guru/design-patterns/chain-of-responsibility) - Format detection strategy
- [Defensive Programming](https://en.wikipedia.org/wiki/Defensive_programming) - Handling unknown data
- [JSON Schema Evolution](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html) - Versioning strategies
