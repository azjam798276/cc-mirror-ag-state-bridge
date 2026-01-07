# Risk Assessment Checklist

**Source:** https://www.itgov-docs.com/blogs/release-management/release-risk-assessment-template
**Relevance:** Engineering Director - Risk Assessment for Releases

## Code Snippet
```typescript
interface RiskItem {
  id: string;
  category: "technical" | "operational" | "security" | "compliance";
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation?: string;
  status: "open" | "mitigated" | "accepted";
}

interface RiskAssessment {
  phaseId: string;
  assessmentDate: Date;
  assessedBy: string;
  risks: RiskItem[];
  overallRiskLevel: "low" | "medium" | "high" | "critical";
  recommendation: "approve" | "approve-with-conditions" | "reject";
  notes?: string;
}

class EngineeringDirectorRiskAssessor {
  private riskMatrix = {
    low: { low: 1, medium: 2, high: 3 },
    medium: { low: 2, medium: 4, high: 6 },
    high: { low: 3, medium: 6, high: 9 }
  };

  async assessPhaseRisks(phaseId: string, artifacts: any): Promise<RiskAssessment> {
    console.log(`[Director] Conducting risk assessment for phase ${phaseId}`);

    const risks: RiskItem[] = [];

    // Technical risks
    risks.push(...await this.assessTechnicalRisks(artifacts));

    // Security risks
    risks.push(...await this.assessSecurityRisks(artifacts));

    // Operational risks
    risks.push(...await this.assessOperationalRisks(artifacts));

    // Calculate overall risk level
    const overallRiskLevel = this.calculateOverallRisk(risks);

    // Determine recommendation
    const recommendation = this.determineRecommendation(risks, overallRiskLevel);

    const assessment: RiskAssessment = {
      phaseId,
      assessmentDate: new Date(),
      assessedBy: "engineering-director",
      risks,
      overallRiskLevel,
      recommendation,
      notes: this.generateNotes(risks, overallRiskLevel)
    };

    // Save assessment
    await this.saveAssessment(assessment);

    return assessment;
  }

  private async assessTechnicalRisks(artifacts: any): Promise<RiskItem[]> {
    const risks: RiskItem[] = [];

    // Check test coverage
    if (artifacts.coverage < 80) {
      risks.push({
        id: "TECH-001",
        category: "technical",
        description: `Low test coverage (${artifacts.coverage}%) increases bug risk`,
        likelihood: "high",
        impact: "high",
        mitigation: "Increase test coverage to ≥90% before deployment",
        status: "open"
      });
    }

    // Check for high complexity
    if (artifacts.complexity > 15) {
      risks.push({
        id: "TECH-002",
        category: "technical",
        description: "High cyclomatic complexity makes code difficult to maintain",
        likelihood: "medium",
        impact: "medium",
        mitigation: "Refactor complex functions into smaller units",
        status: "open"
      });
    }

    // Check for code duplication
    if (artifacts.duplication > 5) {
      risks.push({
        id: "TECH-003",
        category: "technical",
        description: `${artifacts.duplication}% code duplication detected`,
        likelihood: "low",
        impact: "medium",
        mitigation: "Extract common logic into shared utilities",
        status: "open"
      });
    }

    return risks;
  }

  private async assessSecurityRisks(artifacts: any): Promise<RiskItem[]> {
    const risks: RiskItem[] = [];

    // Check for vulnerabilities
    if (artifacts.vulnerabilities?.critical > 0) {
      risks.push({
        id: "SEC-001",
        category: "security",
        description: `${artifacts.vulnerabilities.critical} critical vulnerabilities detected`,
        likelihood: "high",
        impact: "high",
        mitigation: "Patch critical vulnerabilities immediately",
        status: "open"
      });
    }

    // Check for exposed secrets
    if (artifacts.secretsExposed) {
      risks.push({
        id: "SEC-002",
        category: "security",
        description: "Potential secrets or API keys found in code",
        likelihood: "medium",
        impact: "high",
        mitigation: "Move secrets to environment variables",
        status: "open"
      });
    }

    return risks;
  }

  private async assessOperationalRisks(artifacts: any): Promise<RiskItem[]> {
    const risks: RiskItem[] = [];

    // Check for missing documentation
    if (!artifacts.documentation || artifacts.documentation.length === 0) {
      risks.push({
        id: "OPS-001",
        category: "operational",
        description: "No documentation provided",
        likelihood: "high",
        impact: "medium",
        mitigation: "Add README with setup and usage instructions",
        status: "open"
      });
    }

    // Check for missing rollback plan
    if (!artifacts.rollbackPlan) {
      risks.push({
        id: "OPS-002",
        category: "operational",
        description: "No rollback plan documented",
        likelihood: "medium",
        impact: "high",
        mitigation: "Document rollback procedure and test it",
        status: "open"
      });
    }

    return risks;
  }

  private calculateOverallRisk(risks: RiskItem[]): RiskAssessment['overallRiskLevel'] {
    let totalScore = 0;
    let riskCount = 0;

    for (const risk of risks) {
      if (risk.status === "mitigated") continue;

      const score = this.riskMatrix[risk.likelihood][risk.impact];
      totalScore += score;
      riskCount++;
    }

    if (riskCount === 0) return "low";

    const avgScore = totalScore / riskCount;

    if (avgScore >= 7) return "critical";
    if (avgScore >= 5) return "high";
    if (avgScore >= 3) return "medium";
    return "low";
  }

  private determineRecommendation(
    risks: RiskItem[],
    overallRisk: RiskAssessment['overallRiskLevel']
  ): RiskAssessment['recommendation'] {
    const criticalRisks = risks.filter(
      r => r.status === "open" && r.likelihood === "high" && r.impact === "high"
    );

    if (criticalRisks.length > 0) {
      return "reject";
    }

    if (overallRisk === "high" || overallRisk === "critical") {
      return "approve-with-conditions";
    }

    return "approve";
  }

  private generateNotes(risks: RiskItem[], overallRisk: RiskAssessment['overallRiskLevel']): string {
    const openRisks = risks.filter(r => r.status === "open");

    if (openRisks.length === 0) {
      return "No significant risks identified. Phase approved for transition.";
    }

    const highPriorityRisks = openRisks.filter(
      r => (r.likelihood === "high" || r.impact === "high")
    );

    if (highPriorityRisks.length > 0) {
      return `${highPriorityRisks.length} high-priority risk(s) require attention before deployment. ` +
             `Focus on: ${highPriorityRisks.map(r => r.id).join(', ')}. ` +
             `Mitigation strategies provided in risk details.`;
    }

    return `Overall risk level: ${overallRisk}. ` +
           `${openRisks.length} minor risk(s) identified. ` +
           `Recommend proceeding with monitoring plan in place.`;
  }

  private async saveAssessment(assessment: RiskAssessment): Promise<void> {
    const filename = `./risk-assessments/${assessment.phaseId}-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(assessment, null, 2));
    console.log(`[Director] Risk assessment saved: ${filename}`);
  }

  // Generate executive summary report
  generateReport(assessment: RiskAssessment): string {
    let report = `\n╔════════════════════════════════════════════╗\n`;
    report += `║      PHASE RISK ASSESSMENT REPORT      ║\n`;
    report += `╚════════════════════════════════════════════╝\n\n`;

    report += `Phase ID: ${assessment.phaseId}\n`;
    report += `Assessment Date: ${assessment.assessmentDate.toISOString()}\n`;
    report += `Overall Risk Level: ${assessment.overallRiskLevel.toUpperCase()}\n`;
    report += `Recommendation: ${assessment.recommendation.toUpperCase()}\n\n`;

    report += `Risk Summary by Category:\n`;
    const byCategory = assessment.risks.reduce((acc, risk) => {
      acc[risk.category] = (acc[risk.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byCategory).forEach(([cat, count]) => {
      report += `  - ${cat}: ${count} risk(s)\n`;
    });

    report += `\n${assessment.notes}\n`;

    if (assessment.recommendation !== "approve") {
      report += `\n⚠️  ACTION REQUIRED:\n`;
      const openRisks = assessment.risks.filter(r => r.status === "open");
      openRisks.forEach(risk => {
        report += `  [${risk.id}] ${risk.description}\n`;
        if (risk.mitigation) {
          report += `    → ${risk.mitigation}\n`;
        }
      });
    }

    return report;
  }
}
```

## Why This Works
- Risk matrix quantifies subjective assessments
- Category-based assessment ensures comprehensive coverage
- Mitigation strategies guide remediation efforts
- Overall risk level calculation aggregates individual risks
- Structured output enables both human and automated decision-making
