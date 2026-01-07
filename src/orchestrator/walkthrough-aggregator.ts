/**
 * Walkthrough Aggregator
 * 
 * Auto-creates phase summary from worker walkthroughs.
 * Collects all walkthrough.md files from worker brain directories,
 * merges them into a single document with completion metrics.
 * 
 * Features:
 * - Collects walkthroughs from all worker agents
 * - Includes screenshots and recordings
 * - Generates completion certificate with metrics
 * - Stores in orchestrator's brain directory
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import ArtifactReader, { AgentArtifacts, ParsedWalkthrough } from './artifact-reader';
import GeminiMdMessageBus from './gemini-md-bus';

// ============================================================================
// Types
// ============================================================================

export interface WalkthroughSummary {
    phase: string;
    generatedAt: Date;
    completionCertificate: CompletionCertificate;
    agentSummaries: AgentSummary[];
    combinedDocument: string;
    outputPath: string;
}

export interface CompletionCertificate {
    phase: string;
    status: 'complete' | 'partial' | 'in_progress';
    startDate: string;
    completionDate: string;
    metrics: PhaseMetrics;
    agents: AgentCompletionRecord[];
}

export interface PhaseMetrics {
    totalAgents: number;
    completedAgents: number;
    totalTasks: number;
    completedTasks: number;
    percentComplete: number;
    totalScreenshots: number;
    totalRecordings: number;
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
}

export interface AgentCompletionRecord {
    role: string;
    conversationId: string;
    tasksCompleted: number;
    totalTasks: number;
    hasWalkthrough: boolean;
    screenshotCount: number;
    testResults: { passed: number; failed: number; skipped: number };
}

export interface AgentSummary {
    role: string;
    conversationId: string;
    title: string;
    highlights: string[];
    screenshots: string[];
    testsSummary: string;
}

// ============================================================================
// Walkthrough Aggregator
// ============================================================================

export class WalkthroughAggregator {
    private artifactReader: ArtifactReader;
    private messageBus: GeminiMdMessageBus;
    private brainBaseDir: string;

    constructor(brainBaseDir?: string) {
        this.brainBaseDir = brainBaseDir ?? path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
        this.artifactReader = new ArtifactReader(this.brainBaseDir);
        this.messageBus = new GeminiMdMessageBus();
    }

    // --------------------------------------------------------------------------
    // Main Aggregation
    // --------------------------------------------------------------------------

    async aggregatePhaseWalkthroughs(
        phase: string,
        agents: Array<{ conversationId: string; role: string }>,
        outputDir?: string
    ): Promise<WalkthroughSummary> {
        console.log(`[Aggregator] Collecting walkthroughs for phase: ${phase}`);

        // Read all agent artifacts
        const allArtifacts = await this.artifactReader.readMultipleAgents(agents);

        // Get phase state from GEMINI.md
        const orchestratorState = await this.messageBus.getOrchestratorState();

        // Calculate metrics
        const metrics = this.calculateMetrics(allArtifacts);
        const agentRecords = this.generateAgentRecords(allArtifacts);
        const agentSummaries = this.generateAgentSummaries(allArtifacts);

        // Determine completion status
        let status: 'complete' | 'partial' | 'in_progress' = 'in_progress';
        if (metrics.percentComplete === 100) {
            status = 'complete';
        } else if (metrics.percentComplete > 0) {
            status = 'partial';
        }

        // Create completion certificate
        const certificate: CompletionCertificate = {
            phase,
            status,
            startDate: orchestratorState?.currentPhase.startedAt ?? new Date().toISOString(),
            completionDate: new Date().toISOString(),
            metrics,
            agents: agentRecords,
        };

        // Generate combined document
        const combinedDocument = this.generateCombinedDocument(phase, certificate, allArtifacts, agentSummaries);

        // Determine output path
        const resolvedOutputDir = outputDir ?? path.join(process.cwd(), 'docs');
        const outputPath = path.join(resolvedOutputDir, `${phase}-walkthrough-summary.md`);

        // Write output file
        await fs.ensureDir(resolvedOutputDir);
        await fs.writeFile(outputPath, combinedDocument);

        console.log(`[Aggregator] ✅ Walkthrough summary written to: ${outputPath}`);

        return {
            phase,
            generatedAt: new Date(),
            completionCertificate: certificate,
            agentSummaries,
            combinedDocument,
            outputPath,
        };
    }

    // --------------------------------------------------------------------------
    // Metrics Calculation
    // --------------------------------------------------------------------------

    private calculateMetrics(artifacts: AgentArtifacts[]): PhaseMetrics {
        let totalAgents = artifacts.length;
        let completedAgents = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        let totalScreenshots = 0;
        let totalRecordings = 0;
        let testsRun = 0;
        let testsPassed = 0;
        let testsFailed = 0;

        for (const agent of artifacts) {
            if (agent.task) {
                totalTasks += agent.task.totalCount;
                completedTasks += agent.task.completedCount;

                if (agent.task.percentComplete === 100) {
                    completedAgents++;
                }
            }

            if (agent.walkthrough) {
                totalScreenshots += agent.walkthrough.screenshots.length;
                totalRecordings += agent.walkthrough.recordings.length;

                for (const test of agent.walkthrough.testResults) {
                    testsRun++;
                    if (test.status === 'pass') testsPassed++;
                    if (test.status === 'fail') testsFailed++;
                }
            }
        }

        const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
            totalAgents,
            completedAgents,
            totalTasks,
            completedTasks,
            percentComplete,
            totalScreenshots,
            totalRecordings,
            testsRun,
            testsPassed,
            testsFailed,
        };
    }

    private generateAgentRecords(artifacts: AgentArtifacts[]): AgentCompletionRecord[] {
        return artifacts.map(agent => {
            const testResults = { passed: 0, failed: 0, skipped: 0 };

            if (agent.walkthrough) {
                for (const test of agent.walkthrough.testResults) {
                    if (test.status === 'pass') testResults.passed++;
                    else if (test.status === 'fail') testResults.failed++;
                    else testResults.skipped++;
                }
            }

            return {
                role: agent.agentRole,
                conversationId: agent.conversationId,
                tasksCompleted: agent.task?.completedCount ?? 0,
                totalTasks: agent.task?.totalCount ?? 0,
                hasWalkthrough: !!agent.walkthrough,
                screenshotCount: agent.walkthrough?.screenshots.length ?? 0,
                testResults,
            };
        });
    }

    private generateAgentSummaries(artifacts: AgentArtifacts[]): AgentSummary[] {
        return artifacts.map(agent => {
            const highlights: string[] = [];

            // Extract highlights from walkthrough sections
            if (agent.walkthrough) {
                for (const section of agent.walkthrough.sections) {
                    if (section.level <= 2 && section.heading !== agent.walkthrough.title) {
                        highlights.push(section.heading);
                    }
                }
            }

            // Generate test summary
            let testsSummary = 'No tests';
            if (agent.walkthrough && agent.walkthrough.testResults.length > 0) {
                const passed = agent.walkthrough.testResults.filter(t => t.status === 'pass').length;
                const total = agent.walkthrough.testResults.length;
                testsSummary = `${passed}/${total} tests passed`;
            }

            return {
                role: agent.agentRole,
                conversationId: agent.conversationId,
                title: agent.walkthrough?.title ?? 'No walkthrough',
                highlights: highlights.slice(0, 5), // Limit to 5 highlights
                screenshots: agent.walkthrough?.screenshots ?? [],
                testsSummary,
            };
        });
    }

    // --------------------------------------------------------------------------
    // Document Generation
    // --------------------------------------------------------------------------

    private generateCombinedDocument(
        phase: string,
        certificate: CompletionCertificate,
        artifacts: AgentArtifacts[],
        summaries: AgentSummary[]
    ): string {
        const lines: string[] = [];
        const m = certificate.metrics;

        // Header
        lines.push(`# Phase Walkthrough Summary: ${phase}`);
        lines.push('');
        lines.push(`> **Generated:** ${new Date().toISOString()}`);
        lines.push(`> **Status:** ${this.getStatusBadge(certificate.status)}`);
        lines.push('');

        // Completion Certificate
        lines.push('## 📜 Completion Certificate');
        lines.push('');
        lines.push('```');
        lines.push('╔══════════════════════════════════════════════════════════╗');
        lines.push(`║  PHASE COMPLETION CERTIFICATE                            ║`);
        lines.push('╠══════════════════════════════════════════════════════════╣');
        lines.push(`║  Phase:      ${phase.padEnd(43)}║`);
        lines.push(`║  Status:     ${certificate.status.toUpperCase().padEnd(43)}║`);
        lines.push(`║  Started:    ${certificate.startDate.slice(0, 19).padEnd(43)}║`);
        lines.push(`║  Completed:  ${certificate.completionDate.slice(0, 19).padEnd(43)}║`);
        lines.push('╠══════════════════════════════════════════════════════════╣');
        lines.push(`║  Agents:     ${(m.completedAgents + '/' + m.totalAgents + ' complete').padEnd(43)}║`);
        lines.push(`║  Tasks:      ${(m.completedTasks + '/' + m.totalTasks + ' (' + m.percentComplete + '%)').padEnd(43)}║`);
        lines.push(`║  Tests:      ${(m.testsPassed + '/' + m.testsRun + ' passed').padEnd(43)}║`);
        lines.push(`║  Evidence:   ${(m.totalScreenshots + ' screenshots, ' + m.totalRecordings + ' recordings').padEnd(43)}║`);
        lines.push('╚══════════════════════════════════════════════════════════╝');
        lines.push('```');
        lines.push('');

        // Summary Table
        lines.push('## 📊 Agent Summary');
        lines.push('');
        lines.push('| Agent | Progress | Walkthrough | Tests | Screenshots |');
        lines.push('|-------|----------|-------------|-------|-------------|');

        for (const record of certificate.agents) {
            const progress = record.totalTasks > 0
                ? `${record.tasksCompleted}/${record.totalTasks}`
                : '-';
            const walkthrough = record.hasWalkthrough ? '✅' : '❌';
            const tests = record.testResults.passed + record.testResults.failed > 0
                ? `${record.testResults.passed}/${record.testResults.passed + record.testResults.failed}`
                : '-';
            const screenshots = record.screenshotCount > 0 ? `${record.screenshotCount}` : '-';

            lines.push(`| ${record.role} | ${progress} | ${walkthrough} | ${tests} | ${screenshots} |`);
        }

        lines.push('');
        lines.push('---');
        lines.push('');

        // Individual Walkthroughs
        lines.push('## 📝 Agent Walkthroughs');
        lines.push('');

        for (const agent of artifacts) {
            if (agent.walkthrough) {
                lines.push(`### ${agent.agentRole}`);
                lines.push(`> Conversation: \`${agent.conversationId.slice(0, 8)}...\``);
                lines.push('');

                // Include full walkthrough content
                lines.push(agent.walkthrough.rawContent);
                lines.push('');
                lines.push('---');
                lines.push('');
            }
        }

        // Screenshots Gallery
        const allScreenshots: Array<{ agent: string; path: string }> = [];
        for (const agent of artifacts) {
            if (agent.walkthrough) {
                for (const screenshot of agent.walkthrough.screenshots) {
                    allScreenshots.push({ agent: agent.agentRole, path: screenshot });
                }
            }
        }

        if (allScreenshots.length > 0) {
            lines.push('## 🖼️ Screenshots Gallery');
            lines.push('');
            for (const ss of allScreenshots) {
                lines.push(`### ${ss.agent}`);
                lines.push(`![${ss.agent} screenshot](${ss.path})`);
                lines.push('');
            }
        }

        // Footer
        lines.push('---');
        lines.push('');
        lines.push('*This summary was auto-generated by the Walkthrough Aggregator.*');
        lines.push(`*Source: [task-gastown.md](file://${path.join(process.cwd(), 'docs', 'task-gastown.md')})*`);

        return lines.join('\n');
    }

    private getStatusBadge(status: 'complete' | 'partial' | 'in_progress'): string {
        switch (status) {
            case 'complete': return '✅ **COMPLETE**';
            case 'partial': return '🔄 **PARTIAL**';
            case 'in_progress': return '⏳ **IN PROGRESS**';
        }
    }
}

// ============================================================================
// CLI Runner
// ============================================================================

async function main() {
    console.log('📚 Walkthrough Aggregator\n');

    const aggregator = new WalkthroughAggregator();

    // CC-Mirror agents (excluding orchestrator and director)
    const workers = [
        { conversationId: '15b9c503-6ccc-4d27-be08-680a3b9c0af2', role: 'backend-engineer' },
        { conversationId: '64a8119a-82df-466d-b1ef-6a968f8c02f2', role: 'security-engineer' },
        { conversationId: '5858eac3-c35a-44e1-9b13-8023ddcd423d', role: 'qa-engineer' },
        { conversationId: '91ccd3cd-586f-4f0d-b490-7fb42ceed5b2', role: 'devops-engineer' },
    ];

    const summary = await aggregator.aggregatePhaseWalkthroughs(
        'phase-2-context-injection',
        workers
    );

    console.log('\n=== AGGREGATION RESULTS ===\n');
    console.log(`Phase: ${summary.phase}`);
    console.log(`Status: ${summary.completionCertificate.status}`);
    console.log(`Output: ${summary.outputPath}`);
    console.log('');
    console.log('Metrics:');
    const m = summary.completionCertificate.metrics;
    console.log(`  Agents: ${m.completedAgents}/${m.totalAgents} complete`);
    console.log(`  Tasks: ${m.completedTasks}/${m.totalTasks} (${m.percentComplete}%)`);
    console.log(`  Tests: ${m.testsPassed}/${m.testsRun} passed`);
    console.log(`  Screenshots: ${m.totalScreenshots}`);
    console.log(`  Recordings: ${m.totalRecordings}`);
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default WalkthroughAggregator;
