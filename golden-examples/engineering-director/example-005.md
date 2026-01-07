# Multi-Gate Approval Decision System

**Source:** Combined patterns from SonarQube and GitLab CI
**Relevance:** Engineering Director - Comprehensive Quality Decision

## Code Snippet
```typescript
interface QualityGate {
  name: string;
  evaluate: () => Promise<GateResult>;
}

interface GateResult {
  passed: boolean;
  score: number;
  details: string;
  blockers?: string[];
}

interface FinalDecision {
  approved: boolean;
  timestamp: Date;
  gates: Record<string, GateResult>;
  overallScore: number;
  reasoning: string[];
  actionItems: string[];
}

class EngineeringDirectorDecisionSystem {
  private gates: QualityGate[] = [];

  registerGate(gate: QualityGate) {
    this.gates.push(gate);
  }

  async makeDecision(phaseId: string): Promise<FinalDecision> {
    console.log(`\n[Director] Evaluating ${this.gates.length} quality gates for phase ${phaseId}...`);

    const gateResults: Record<string, GateResult> = {};
    const reasoning: string[] = [];
    const actionItems: string[] = [];

    // Evaluate all gates
    for (const gate of this.gates) {
      console.log(`  → Evaluating: ${gate.name}...`);
      const result = await gate.evaluate();
      gateResults[gate.name] = result;

      if (result.passed) {
        console.log(`    ✅ ${gate.name}: PASSED (score: ${result.score})`);
        reasoning.push(`${gate.name} meets standards (${result.score}%)`);
      } else {
        console.log(`    ❌ ${gate.name}: FAILED (score: ${result.score})`);
        reasoning.push(`${gate.name} below threshold (${result.score}%)`);
        
        if (result.blockers) {
          actionItems.push(...result.blockers);
        }
      }
    }

    // Calculate overall score (weighted average)
    const totalScore = Object.values(gateResults).reduce((sum, r) => sum + r.score, 0);
    const overallScore = totalScore / this.gates.length;

    // Determine approval
    const allPassed = Object.values(gateResults).every(r => r.passed);
    const approved = allPassed && overallScore >= 85;

    const decision: FinalDecision = {
      approved,
      timestamp: new Date(),
      gates: gateResults,
      overallScore: Math.round(overallScore),
      reasoning: [
        approved 
          ? `Phase meets all quality standards (overall score: ${Math.round(overallScore)}%)`
          : `Phase requires improvements (overall score: ${Math.round(overallScore)}%)`,
        ...reasoning
      ],
      actionItems: approved ? [] : actionItems
    };

    // Log decision
    await this.logDecision(phaseId, decision);

    // Display decision
    this.displayDecision(decision);

    return decision;
  }

  private async logDecision(phaseId: string, decision: FinalDecision) {
    const logEntry = {
      phaseId,
      decision,
      environment: process.env.NODE_ENV,
      commit: process.env.GITHUB_SHA
    };

    await fs.writeFile(
      `./decisions/${phaseId}-${Date.now()}.json`,
      JSON.stringify(logEntry, null, 2)
    );
  }

  private displayDecision(decision: FinalDecision) {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║        FINAL APPROVAL DECISION         ║`);
    console.log(`╚════════════════════════════════════════════╝`);
    console.log(`\nStatus: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
    console.log(`Overall Score: ${decision.overallScore}%`);
    console.log(`\nReasoning:`);
    decision.reasoning.forEach(r => console.log(`  • ${r}`));

    if (decision.actionItems.length > 0) {
      console.log(`\n⚠️  Required Actions:`);
      decision.actionItems.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
    }

    console.log(`\nDecision logged at: ${decision.timestamp.toISOString()}\n`);
  }
}

// Example usage with multiple gates
async function reviewPhase(phaseId: string) {
  const director = new EngineeringDirectorDecisionSystem();

  // Gate 1: Test Coverage
  director.registerGate({
    name: "Test Coverage",
    evaluate: async () => {
      const coverage = await getCoverageMetrics();
      const passed = coverage.total >= 90;
      
      return {
        passed,
        score: coverage.total,
        details: `${coverage.lines}% lines, ${coverage.branches}% branches`,
        blockers: passed ? undefined : ["Increase test coverage to ≥90%"]
      };
    }
  });

  // Gate 2: Code Quality
  director.registerGate({
    name: "Code Quality",
    evaluate: async () => {
      const metrics = await getCodeQualityMetrics();
      const passed = metrics.maintainability >= 'A';
      
      return {
        passed,
        score: passed ? 95 : 70,
        details: `Maintainability: ${metrics.maintainability}, Complexity: ${metrics.complexity}`,
        blockers: passed ? undefined : ["Refactor high-complexity functions"]
      };
    }
  });

  // Gate 3: Security
  director.registerGate({
    name: "Security Scan",
    evaluate: async () => {
      const vulns = await getSecurityVulnerabilities();
      const passed = vulns.critical === 0 && vulns.high === 0;
      
      return {
        passed,
        score: passed ? 100 : (vulns.critical > 0 ? 0 : 50),
        details: `Critical: ${vulns.critical}, High: ${vulns.high}, Medium: ${vulns.medium}`,
        blockers: passed ? undefined : ["Fix all critical and high vulnerabilities"]
      };
    }
  });

  // Gate 4: Documentation
  director.registerGate({
    name: "Documentation",
    evaluate: async () => {
      const docScore = await getDocumentationScore();
      const passed = docScore >= 80;
      
      return {
        passed,
        score: docScore,
        details: `${docScore}% of public APIs documented`,
        blockers: passed ? undefined : ["Document all public APIs"]
      };
    }
  });

  const decision = await director.makeDecision(phaseId);

  return decision.approved;
}
```

## Why This Works
- Multi-gate approach provides comprehensive quality assessment
- Weighted scoring balances different quality dimensions
- Blocker identification guides remediation efforts
- Audit trail via JSON logging ensures compliance
- Extensible design allows adding new gates without code changes
