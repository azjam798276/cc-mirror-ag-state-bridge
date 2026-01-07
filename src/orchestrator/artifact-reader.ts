/**
 * Cross-Agent Artifact Reader
 * 
 * Reads artifacts (walkthrough.md, implementation_plan.md, task.md) from
 * other agents' brain directories and aggregates results for the orchestrator.
 * 
 * Use cases:
 * - Orchestrator reading worker walkthroughs for phase summary
 * - Director reviewing all worker artifacts before approval
 * - Aggregating completion evidence across agents
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactMetadata {
    conversationId: string;
    agentRole: string;
    artifactType: 'task' | 'implementation_plan' | 'walkthrough' | 'other';
    filePath: string;
    fileName: string;
    lastModified: Date;
    sizeBytes: number;
    exists: boolean;
}

export interface ParsedWalkthrough {
    conversationId: string;
    agentRole: string;
    title: string;
    sections: WalkthroughSection[];
    screenshots: string[];
    recordings: string[];
    testResults: TestResult[];
    rawContent: string;
}

export interface WalkthroughSection {
    heading: string;
    level: number;
    content: string;
}

export interface TestResult {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    details?: string;
}

export interface ParsedTaskMd {
    conversationId: string;
    agentRole: string;
    title: string;
    items: TaskItem[];
    completedCount: number;
    totalCount: number;
    percentComplete: number;
}

export interface TaskItem {
    text: string;
    status: 'pending' | 'in_progress' | 'completed';
    lineNumber: number;
}

export interface AgentArtifacts {
    conversationId: string;
    agentRole: string;
    brainDir: string;
    task?: ParsedTaskMd;
    walkthrough?: ParsedWalkthrough;
    implementationPlan?: string;
    otherFiles: string[];
}

export interface AggregatedPhaseReport {
    phase: string;
    generatedAt: Date;
    agents: AgentArtifacts[];
    summary: {
        totalAgents: number;
        completedAgents: number;
        totalTasks: number;
        completedTasks: number;
        percentComplete: number;
    };
    combinedWalkthrough: string;
}

// ============================================================================
// Artifact Reader
// ============================================================================

export class ArtifactReader {
    private brainBaseDir: string;

    constructor(brainBaseDir?: string) {
        this.brainBaseDir = brainBaseDir ?? path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    }

    // --------------------------------------------------------------------------
    // Core Reading Operations
    // --------------------------------------------------------------------------

    async readAgentArtifacts(conversationId: string, agentRole: string): Promise<AgentArtifacts> {
        const brainDir = path.join(this.brainBaseDir, conversationId);

        const artifacts: AgentArtifacts = {
            conversationId,
            agentRole,
            brainDir,
            otherFiles: [],
        };

        // Check if brain directory exists
        if (!await fs.pathExists(brainDir)) {
            console.log(`[ArtifactReader] Brain directory not found: ${brainDir}`);
            return artifacts;
        }

        // Read task.md
        const taskPath = path.join(brainDir, 'task.md');
        if (await fs.pathExists(taskPath)) {
            const content = await fs.readFile(taskPath, 'utf-8');
            artifacts.task = this.parseTaskMd(content, conversationId, agentRole);
        }

        // Read walkthrough.md
        const walkthroughPath = path.join(brainDir, 'walkthrough.md');
        if (await fs.pathExists(walkthroughPath)) {
            const content = await fs.readFile(walkthroughPath, 'utf-8');
            artifacts.walkthrough = this.parseWalkthrough(content, conversationId, agentRole, brainDir);
        }

        // Read implementation_plan.md
        const planPath = path.join(brainDir, 'implementation_plan.md');
        if (await fs.pathExists(planPath)) {
            artifacts.implementationPlan = await fs.readFile(planPath, 'utf-8');
        }

        // Find other files (screenshots, recordings)
        const files = await fs.readdir(brainDir);
        artifacts.otherFiles = files.filter(f =>
            !f.endsWith('.metadata.json') &&
            !f.endsWith('.resolved') &&
            !f.startsWith('.') &&
            !['task.md', 'walkthrough.md', 'implementation_plan.md'].includes(f)
        );

        return artifacts;
    }

    async readMultipleAgents(agents: Array<{ conversationId: string; role: string }>): Promise<AgentArtifacts[]> {
        const results: AgentArtifacts[] = [];

        for (const agent of agents) {
            const artifacts = await this.readAgentArtifacts(agent.conversationId, agent.role);
            results.push(artifacts);
        }

        return results;
    }

    // --------------------------------------------------------------------------
    // Parsing Functions
    // --------------------------------------------------------------------------

    parseTaskMd(content: string, conversationId: string, agentRole: string): ParsedTaskMd {
        const lines = content.split('\n');
        const items: TaskItem[] = [];

        // Extract title (first # heading)
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : 'Untitled';

        // Parse checklist items
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^-\s*\[([ x\/])\]\s*(.+)$/);

            if (match) {
                const marker = match[1];
                const text = match[2].trim();

                let status: 'pending' | 'in_progress' | 'completed';
                if (marker === 'x') {
                    status = 'completed';
                } else if (marker === '/') {
                    status = 'in_progress';
                } else {
                    status = 'pending';
                }

                items.push({ text, status, lineNumber: i + 1 });
            }
        }

        const completedCount = items.filter(i => i.status === 'completed').length;
        const totalCount = items.length;
        const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
            conversationId,
            agentRole,
            title,
            items,
            completedCount,
            totalCount,
            percentComplete,
        };
    }

    parseWalkthrough(content: string, conversationId: string, agentRole: string, brainDir: string): ParsedWalkthrough {
        const sections: WalkthroughSection[] = [];
        const screenshots: string[] = [];
        const recordings: string[] = [];
        const testResults: TestResult[] = [];

        // Extract title
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : 'Walkthrough';

        // Parse sections (headings)
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        let lastIndex = 0;
        const matches: Array<{ level: number; heading: string; start: number }> = [];

        while ((match = headingRegex.exec(content)) !== null) {
            matches.push({
                level: match[1].length,
                heading: match[2],
                start: match.index,
            });
        }

        // Extract section content
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];
            const endIndex = next ? next.start : content.length;
            const sectionContent = content.slice(current.start, endIndex).trim();

            sections.push({
                heading: current.heading,
                level: current.level,
                content: sectionContent,
            });
        }

        // Find screenshots (![...](path))
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        while ((match = imageRegex.exec(content)) !== null) {
            const imagePath = match[2];
            if (imagePath.endsWith('.png') || imagePath.endsWith('.jpg') || imagePath.endsWith('.webp')) {
                screenshots.push(imagePath);
            }
            if (imagePath.endsWith('.mp4') || imagePath.endsWith('.webm')) {
                recordings.push(imagePath);
            }
        }

        // Find test results (✅ or ❌ patterns)
        const testRegex = /([✅❌⏭])\s*(.+?)(?:\n|$)/g;
        while ((match = testRegex.exec(content)) !== null) {
            const icon = match[1];
            const name = match[2].trim();
            let status: 'pass' | 'fail' | 'skip';

            if (icon === '✅') status = 'pass';
            else if (icon === '❌') status = 'fail';
            else status = 'skip';

            testResults.push({ name, status });
        }

        return {
            conversationId,
            agentRole,
            title,
            sections,
            screenshots,
            recordings,
            testResults,
            rawContent: content,
        };
    }

    // --------------------------------------------------------------------------
    // Aggregation Functions
    // --------------------------------------------------------------------------

    async aggregatePhaseReport(
        phase: string,
        agents: Array<{ conversationId: string; role: string }>
    ): Promise<AggregatedPhaseReport> {
        const agentArtifacts = await this.readMultipleAgents(agents);

        // Calculate summary stats
        let totalTasks = 0;
        let completedTasks = 0;
        let completedAgents = 0;

        for (const artifacts of agentArtifacts) {
            if (artifacts.task) {
                totalTasks += artifacts.task.totalCount;
                completedTasks += artifacts.task.completedCount;

                if (artifacts.task.percentComplete === 100) {
                    completedAgents++;
                }
            }
        }

        const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Generate combined walkthrough
        const combinedWalkthrough = this.generateCombinedWalkthrough(phase, agentArtifacts);

        return {
            phase,
            generatedAt: new Date(),
            agents: agentArtifacts,
            summary: {
                totalAgents: agents.length,
                completedAgents,
                totalTasks,
                completedTasks,
                percentComplete,
            },
            combinedWalkthrough,
        };
    }

    generateCombinedWalkthrough(phase: string, agents: AgentArtifacts[]): string {
        const lines: string[] = [];

        lines.push(`# Phase Summary: ${phase}`);
        lines.push('');
        lines.push(`> Generated: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('## Summary');
        lines.push('');
        lines.push('| Agent | Progress | Status |');
        lines.push('|-------|----------|--------|');

        for (const agent of agents) {
            const task = agent.task;
            if (task) {
                const status = task.percentComplete === 100 ? '✅ Complete' : `${task.percentComplete}%`;
                lines.push(`| ${agent.agentRole} | ${task.completedCount}/${task.totalCount} | ${status} |`);
            } else {
                lines.push(`| ${agent.agentRole} | - | No task.md |`);
            }
        }

        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## Agent Walkthroughs');
        lines.push('');

        for (const agent of agents) {
            if (agent.walkthrough) {
                lines.push(`### ${agent.agentRole} (${agent.conversationId.slice(0, 8)})`);
                lines.push('');
                lines.push(agent.walkthrough.rawContent);
                lines.push('');
                lines.push('---');
                lines.push('');
            }
        }

        lines.push('## Artifacts');
        lines.push('');

        for (const agent of agents) {
            if (agent.otherFiles.length > 0) {
                lines.push(`### ${agent.agentRole}`);
                for (const file of agent.otherFiles) {
                    const filePath = path.join(agent.brainDir, file);
                    lines.push(`- [${file}](file://${filePath})`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    // --------------------------------------------------------------------------
    // Utility Functions
    // --------------------------------------------------------------------------

    async getArtifactMetadata(conversationId: string, fileName: string): Promise<ArtifactMetadata> {
        const brainDir = path.join(this.brainBaseDir, conversationId);
        const filePath = path.join(brainDir, fileName);

        const exists = await fs.pathExists(filePath);
        let lastModified = new Date(0);
        let sizeBytes = 0;

        if (exists) {
            const stat = await fs.stat(filePath);
            lastModified = stat.mtime;
            sizeBytes = stat.size;
        }

        let artifactType: ArtifactMetadata['artifactType'] = 'other';
        if (fileName === 'task.md') artifactType = 'task';
        else if (fileName === 'implementation_plan.md') artifactType = 'implementation_plan';
        else if (fileName === 'walkthrough.md') artifactType = 'walkthrough';

        return {
            conversationId,
            agentRole: '', // Caller must provide
            artifactType,
            filePath,
            fileName,
            lastModified,
            sizeBytes,
            exists,
        };
    }

    async listBrainDirectories(): Promise<string[]> {
        if (!await fs.pathExists(this.brainBaseDir)) {
            return [];
        }

        const dirs = await fs.readdir(this.brainBaseDir);
        return dirs.filter(d => d.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/));
    }
}

// ============================================================================
// CLI Runner
// ============================================================================

export async function main() {
    console.log('📚 Cross-Agent Artifact Reader\n');

    const reader = new ArtifactReader();

    // CC-Mirror agents
    const agents = [
        { conversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf', role: 'orchestrator' },
        { conversationId: '15b9c503-6ccc-4d27-be08-680a3b9c0af2', role: 'backend-engineer' },
        { conversationId: '64a8119a-82df-466d-b1ef-6a968f8c02f2', role: 'security-engineer' },
        { conversationId: '5858eac3-c35a-44e1-9b13-8023ddcd423d', role: 'qa-engineer' },
        { conversationId: '91ccd3cd-586f-4f0d-b490-7fb42ceed5b2', role: 'devops-engineer' },
        { conversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1', role: 'engineering-director' },
    ];

    // Generate phase report
    const report = await reader.aggregatePhaseReport('phase-2-context-injection', agents);

    console.log('=== PHASE REPORT ===\n');
    console.log(`Phase: ${report.phase}`);
    console.log(`Generated: ${report.generatedAt.toISOString()}`);
    console.log('');
    console.log('Summary:');
    console.log(`  Agents: ${report.summary.completedAgents}/${report.summary.totalAgents} complete`);
    console.log(`  Tasks: ${report.summary.completedTasks}/${report.summary.totalTasks} (${report.summary.percentComplete}%)`);
    console.log('');
    console.log('Agent Details:');

    for (const agent of report.agents) {
        const taskInfo = agent.task
            ? `${agent.task.completedCount}/${agent.task.totalCount} tasks (${agent.task.percentComplete}%)`
            : 'No task.md';
        const walkthroughInfo = agent.walkthrough ? '✓ walkthrough' : '';
        const planInfo = agent.implementationPlan ? '✓ plan' : '';

        console.log(`  ${agent.agentRole}: ${taskInfo} ${walkthroughInfo} ${planInfo}`);
    }

    // Write combined walkthrough
    const outputPath = path.join(process.cwd(), 'docs', 'phase-2-combined-walkthrough.md');
    await fs.writeFile(outputPath, report.combinedWalkthrough);
    console.log(`\n✅ Combined walkthrough written to: ${outputPath}`);
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default ArtifactReader;
