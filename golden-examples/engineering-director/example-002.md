# Approval Workflow with Structured Decision Output

**Source:** https://temporal.io/blog/build-resilient-distributed-workflows-with-temporal-typescript-sdk-demo
**Relevance:** Engineering Director - Phase Transition Approval

## Code Snippet
```typescript
interface ApprovalRequest {
  phaseId: string;
  phaseName: string;
  artifacts: {
    code: string[];
    tests: string[];
    documentation: string[];
  };
  metrics: {
    coverage: number;
    complexity: number;
    bugs: number;
  };
  submittedBy: string;
  submittedAt: Date;
}

interface ApprovalDecision {
  approved: boolean;
  decisionBy: string;
  decisionAt: Date;
  reasoning: string;
  conditions?: string[];
  requiresChanges?: {
    category: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
  nextActions: string[];
}

class EngineeringDirectorApproval {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();

  // Request approval for phase transition
  async requestApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    console.log(`[Director] Approval requested for phase: ${request.phaseName}`);
    
    this.pendingApprovals.set(request.phaseId, request);

    // Auto-evaluate for instant feedback
    const autoDecision = await this.autoEvaluate(request);
    
    if (autoDecision.approved) {
      // Fast-track if all criteria met
      return autoDecision;
    }

    // Otherwise, require manual review
    console.log(`[Director] Manual review required for ${request.phaseId}`);
    
    // In production, this would wait for human input via webhook/UI
    // For now, simulate evaluation
    return this.manualReview(request);
  }

  private async autoEvaluate(request: ApprovalRequest): Promise<ApprovalDecision> {
    const issues: ApprovalDecision['requiresChanges'] = [];

    // Check coverage
    if (request.metrics.coverage < 90) {
      issues.push({
        category: "Testing",
        description: `Coverage ${request.metrics.coverage}% below 90% threshold`,
        priority: "high"
      });
    }

    // Check complexity
    if (request.metrics.complexity > 10) {
      issues.push({
        category: "Code Quality",
        description: `Cyclomatic complexity ${request.metrics.complexity} exceeds limit of 10`,
        priority: "medium"
      });
    }

    // Check bugs
    if (request.metrics.bugs > 0) {
      issues.push({
        category: "Correctness",
        description: `${request.metrics.bugs} bugs detected by static analysis`,
        priority: "high"
      });
    }

    // Check artifacts
    if (request.artifacts.tests.length === 0) {
      issues.push({
        category: "Testing",
        description: "No test files found",
        priority: "high"
      });
    }

    const approved = issues.length === 0;

    const decision: ApprovalDecision = {
      approved,
      decisionBy: "auto-evaluation",
      decisionAt: new Date(),
      reasoning: approved
        ? "All automated quality checks passed"
        : `Failed ${issues.filter(i => i.priority === 'high').length} high-priority checks`,
      requiresChanges: approved ? undefined : issues,
      nextActions: approved
        ? ["Proceed to next phase"]
        : ["Fix high-priority issues", "Re-submit for approval"]
    };

    return decision;
  }

  private async manualReview(request: ApprovalRequest): Promise<ApprovalDecision> {
    // Simulate human review (in production, this waits for webhook/signal)
    
    const decision: ApprovalDecision = {
      approved: true,
      decisionBy: "engineering-director",
      decisionAt: new Date(),
      reasoning: "Code quality is acceptable. Minor refactoring suggestions noted but not blocking.",
      conditions: [
        "Address TODO comments before production deployment",
        "Add inline documentation for complex algorithms"
      ],
      nextActions: [
        "Proceed to deployment phase",
        "Schedule code walkthrough with team"
      ]
    };

    return decision;
  }

  // Export decision as JSON for audit trail
  exportDecision(phaseId: string, decision: ApprovalDecision): string {
    return JSON.stringify({
      phaseId,
      decision,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: "engineering-director-service",
        version: "1.0"
      }
    }, null, 2);
  }
}

// Usage in workflow
async function phaseTransitionWorkflow(phaseId: string) {
  const director = new EngineeringDirectorApproval();

  const request: ApprovalRequest = {
    phaseId,
    phaseName: "Implementation",
    artifacts: {
      code: ["src/user.ts", "src/auth.ts"],
      tests: ["src/user.test.ts"],
      documentation: ["README.md"]
    },
    metrics: {
      coverage: 92,
      complexity: 8,
      bugs: 0
    },
    submittedBy: "mayor-orchestrator",
    submittedAt: new Date()
  };

  const decision = await director.requestApproval(request);

  console.log("\n=== APPROVAL DECISION ===");
  console.log(`Status: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
  console.log(`Reasoning: ${decision.reasoning}`);
  
  if (decision.conditions) {
    console.log("\nConditions:");
    decision.conditions.forEach(c => console.log(`  - ${c}`));
  }

  if (decision.requiresChanges) {
    console.log("\nRequired Changes:");
    decision.requiresChanges.forEach(c => {
      console.log(`  [${c.priority.toUpperCase()}] ${c.category}: ${c.description}`);
    });
  }

  // Save decision to audit log
  const jsonDecision = director.exportDecision(phaseId, decision);
  await fs.writeFile(`./decisions/${phaseId}.json`, jsonDecision);

  return decision.approved;
}
```

## Why This Works
- Structured decision output is machine-readable and auditable
- Auto-evaluation provides instant feedback for common cases
- Conditions allow "approved with reservations" scenarios
- Priority levels on required changes help teams triage work
- JSON export creates compliance-ready audit trail
