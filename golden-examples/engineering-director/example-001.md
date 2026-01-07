# Code Coverage Quality Gate

**Source:** https://www.propelcode.ai/blog/continuous-integration-code-quality-gates-setup-guide
**Relevance:** Engineering Director - Quality Gate Implementation

## Code Snippet
```typescript
interface CoverageReport {
  total: {
    lines: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
}

interface QualityGateResult {
  passed: boolean;
  metrics: {
    name: string;
    actual: number;
    required: number;
    passed: boolean;
  }[];
  recommendation?: string;
}

class EngineeringDirector {
  private thresholds = {
    lines: 90,
    statements: 90,
    functions: 85,
    branches: 80
  };

  async evaluateCoverage(coveragePath: string): Promise<QualityGateResult> {
    const coverage: CoverageReport = JSON.parse(
      await fs.readFile(coveragePath, 'utf-8')
    );

    const metrics: QualityGateResult['metrics'] = [];
    let allPassed = true;

    // Evaluate each metric
    for (const [metric, threshold] of Object.entries(this.thresholds)) {
      const actual = coverage.total[metric as keyof typeof coverage.total].pct;
      const passed = actual >= threshold;
      
      metrics.push({
        name: metric,
        actual,
        required: threshold,
        passed
      });

      if (!passed) {
        allPassed = false;
        console.error(`❌ ${metric} coverage ${actual}% < ${threshold}% threshold`);
      } else {
        console.log(`✅ ${metric} coverage: ${actual}%`);
      }
    }

    const result: QualityGateResult = {
      passed: allPassed,
      metrics
    };

    if (!allPassed) {
      result.recommendation = this.generateRecommendation(metrics);
    }

    return result;
  }

  private generateRecommendation(metrics: QualityGateResult['metrics']): string {
    const failed = metrics.filter(m => !m.passed);
    
    if (failed.length === 0) return "";

    const worst = failed.reduce((prev, curr) => 
      (curr.actual - curr.required) < (prev.actual - prev.required) ? curr : prev
    );

    const gap = worst.required - worst.actual;

    return `Priority: Improve ${worst.name} coverage by ${gap.toFixed(1)}%. ` +
           `Add tests for untested ${worst.name === 'branches' ? 'conditional paths' : 'code sections'}.`;
  }

  // Approve or reject phase transition
  async reviewPhaseCompletion(phaseId: string): Promise<{
    approved: boolean;
    reason: string;
    gates: QualityGateResult[];
  }> {
    console.log(`[Director] Reviewing phase ${phaseId}`);

    const gates: QualityGateResult[] = [];

    // Gate 1: Coverage
    const coverageGate = await this.evaluateCoverage('./coverage/coverage-summary.json');
    gates.push(coverageGate);

    // Gate 2: Linting (example)
    const lintGate = await this.evaluateLinting('./reports/eslint.json');
    gates.push(lintGate);

    // Gate 3: Security (example)
    const securityGate = await this.evaluateSecurity('./reports/audit.json');
    gates.push(securityGate);

    const allPassed = gates.every(g => g.passed);

    return {
      approved: allPassed,
      reason: allPassed 
        ? "All quality gates passed. Phase approved for transition."
        : `Quality gates failed: ${gates.filter(g => !g.passed).map(g => g.recommendation).join('; ')}`,
      gates
    };
  }
}
```

## Why This Works
- Threshold-based gates are objective and non-negotiable
- Granular metrics (lines, branches, functions) catch different coverage gaps
- Recommendations guide developers on what to fix
- Multiple gates (coverage, linting, security) provide comprehensive quality checks
