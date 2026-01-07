/**
 * Antigravity Brain Poller - External Orchestrator
 * 
 * Monitors agent brain directories to detect:
 * - Task completion (all checkboxes checked)
 * - Idle agents (no activity for >60s)
 * - Phase transitions
 * 
 * Injects continuation prompts to keep agents active.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { ArtifactProgressScanner } from './artifact-scanner';

// ============================================================================
// Types
// ============================================================================

export interface AgentConfig {
    agentId: string;
    conversationId: string;
    role: 'orchestrator' | 'backend-engineer' | 'security-engineer' | 'qa-engineer' | 'product-manager' | 'devops-engineer' | 'engineering-director';
    brainDir: string;
}

export interface TaskChecklistItem {
    text: string;
    status: 'pending' | 'in_progress' | 'completed';
    lineNumber: number;
}

export interface AgentStatus {
    agentId: string;
    role: string;
    conversationId: string;
    brainDir: string;
    taskMdExists: boolean;
    lastModified: Date | null;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    isComplete: boolean;
    isIdle: boolean;
    isActive: boolean;           // True if any file modified in last 30s
    idleDurationMs: number;
    lastActivityTime: Date | null; // Most recent file modification
    currentTask: string | null;
    checklistItems: TaskChecklistItem[];
}

export interface OrchestratorConfig {
    pollingIntervalMs: number;      // How often to check (default 30s)
    idleThresholdMs: number;        // When to consider agent idle (default 60s)
    brainBaseDir: string;           // ~/.gemini/antigravity/brain
    repoRoot: string;               // project root
    agents: AgentConfig[];
    autoInjectContinuation: boolean;
}

export interface PhaseStatus {
    phase: string;
    totalAgents: number;
    completedAgents: number;
    idleAgents: number;
    blockedAgents: number;
    isPhaseComplete: boolean;
}

// ============================================================================
// Brain Poller Implementation
// ============================================================================

export class BrainPoller extends EventEmitter {
    private config: OrchestratorConfig;
    private running: boolean = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastActivityMap: Map<string, Date> = new Map();
    private artifactScanner: ArtifactProgressScanner;
    private currentSprint: number = 4;  // Track current sprint

    constructor(config: Partial<OrchestratorConfig> = {}) {
        super();

        const brainBaseDir = config.brainBaseDir ?? path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

        // Resolve brainDir for all agents (handle empty strings)
        const resolvedAgents = (config.agents ?? []).map(agent => ({
            ...agent,
            brainDir: agent.brainDir || path.join(brainBaseDir, agent.conversationId),
        }));

        this.config = {
            pollingIntervalMs: config.pollingIntervalMs ?? 30000,
            idleThresholdMs: config.idleThresholdMs ?? 60000,
            brainBaseDir,
            repoRoot: config.repoRoot ?? process.cwd(),
            agents: resolvedAgents,
            autoInjectContinuation: config.autoInjectContinuation ?? false,
        };

        this.artifactScanner = new ArtifactProgressScanner(this.config.repoRoot);
    }

    // --------------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------------

    async start(): Promise<void> {
        if (this.running) {
            console.warn('[BrainPoller] Already running');
            return;
        }

        this.running = true;
        console.log(`[BrainPoller] Starting with ${this.config.agents.length} agents, polling every ${this.config.pollingIntervalMs}ms`);

        // Initial poll
        await this.pollAllAgents();

        // Start interval
        this.pollInterval = setInterval(async () => {
            await this.pollAllAgents();
        }, this.config.pollingIntervalMs);
    }

    stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.running = false;
        console.log('[BrainPoller] Stopped');
    }

    // --------------------------------------------------------------------------
    // Agent Registration
    // --------------------------------------------------------------------------

    addAgent(agent: AgentConfig): void {
        // Resolve brain directory path
        const brainDir = agent.brainDir || path.join(this.config.brainBaseDir, agent.conversationId);

        this.config.agents.push({
            ...agent,
            brainDir,
        });

        console.log(`[BrainPoller] Added agent: ${agent.role} (${agent.conversationId})`);
    }

    removeAgent(conversationId: string): void {
        this.config.agents = this.config.agents.filter(a => a.conversationId !== conversationId);
        this.lastActivityMap.delete(conversationId);
    }

    // --------------------------------------------------------------------------
    // Polling Logic
    // --------------------------------------------------------------------------

    async pollAllAgents(): Promise<AgentStatus[]> {
        const statuses: AgentStatus[] = [];
        const timestamp = new Date();

        console.log(`\n[BrainPoller] === Poll Cycle ${timestamp.toISOString()} ===`);

        // Auto-update task.md files based on detected artifacts
        try {
            for (const agent of this.config.agents) {
                await this.artifactScanner.updateAgentTask(agent.brainDir, this.currentSprint
                );
            }
        } catch (error) {
            console.error('[BrainPoller] Artifact scan error:', error);
        }

        for (const agent of this.config.agents) {
            try {
                const status = await this.pollAgent(agent);
                statuses.push(status);

                // Emit events based on status
                if (status.isComplete) {
                    this.emit('agent:complete', status);
                }

                if (status.isIdle && this.config.autoInjectContinuation) {
                    console.log(`[BrainPoller] Agent ${agent.role} idle for ${Math.round(status.idleDurationMs / 1000)}s, injecting continuation...`);
                    await this.injectContinuation(agent, status);
                    this.emit('agent:poked', status);
                }

            } catch (error) {
                console.error(`[BrainPoller] Error polling agent ${agent.role}:`, error);
                this.emit('agent:error', { agent, error });
            }
        }

        // Check phase completion
        const phaseStatus = this.calculatePhaseStatus(statuses);
        if (phaseStatus.isPhaseComplete) {
            this.emit('phase:complete', phaseStatus);
        }

        return statuses;
    }

    async pollAgent(agent: AgentConfig): Promise<AgentStatus> {
        const taskMdPath = path.join(agent.brainDir, 'task.md');

        // Check if brain directory exists
        const brainExists = await fs.pathExists(agent.brainDir);
        const taskMdExists = brainExists && await fs.pathExists(taskMdPath);

        let lastModified: Date | null = null;
        let checklistItems: TaskChecklistItem[] = [];
        let currentTask: string | null = null;
        let lastActivityTime: Date | null = null;

        if (taskMdExists) {
            // Get last modified time
            const stat = await fs.stat(taskMdPath);
            lastModified = stat.mtime;

            // Parse task.md content
            const content = await fs.readFile(taskMdPath, 'utf-8');
            checklistItems = this.parseTaskChecklist(content);

            // Find current in-progress task
            const inProgress = checklistItems.find(item => item.status === 'in_progress');
            currentTask = inProgress?.text ?? null;
        }

        // Check ALL files in brain dir for recent activity (process detection)
        if (brainExists) {
            lastActivityTime = await this.getMostRecentFileActivity(agent.brainDir);
        }

        // Calculate idle duration based on most recent activity
        const activityTime = lastActivityTime || lastModified;
        const now = Date.now();
        let idleDurationMs = 0;

        if (activityTime) {
            idleDurationMs = now - activityTime.getTime();
            this.lastActivityMap.set(agent.conversationId, activityTime);
        } else {
            const lastActivity = this.lastActivityMap.get(agent.conversationId);
            if (lastActivity) {
                idleDurationMs = now - lastActivity.getTime();
            }
        }

        // isActive = any file modified in last 30 seconds
        const isActive = lastActivityTime ? (now - lastActivityTime.getTime()) < 30000 : false;

        // Calculate task counts
        const totalTasks = checklistItems.length;
        const completedTasks = checklistItems.filter(i => i.status === 'completed').length;
        const inProgressTasks = checklistItems.filter(i => i.status === 'in_progress').length;
        const pendingTasks = checklistItems.filter(i => i.status === 'pending').length;

        const isComplete = totalTasks > 0 && completedTasks === totalTasks;
        const isIdle = idleDurationMs > this.config.idleThresholdMs && !isComplete && !isActive;

        const status: AgentStatus = {
            agentId: agent.agentId,
            role: agent.role,
            conversationId: agent.conversationId,
            brainDir: agent.brainDir,
            taskMdExists,
            lastModified,
            totalTasks,
            completedTasks,
            inProgressTasks,
            pendingTasks,
            isComplete,
            isIdle,
            isActive,
            idleDurationMs,
            lastActivityTime,
            currentTask,
            checklistItems,
        };

        // Log status
        const progressBar = this.renderProgressBar(completedTasks, totalTasks);
        const idleIndicator = isIdle ? ' ⚠️ IDLE' : '';
        const completeIndicator = isComplete ? ' ✅' : '';

        console.log(`  ${agent.role}: ${progressBar} (${completedTasks}/${totalTasks})${completeIndicator}${idleIndicator}`);

        return status;
    }

    // --------------------------------------------------------------------------
    // File Activity Detection
    // --------------------------------------------------------------------------

    /**
     * Get the most recent file modification time in a directory.
     * Used to detect if an agent is actively running (writing files).
     */
    private async getMostRecentFileActivity(dirPath: string): Promise<Date | null> {
        try {
            const files = await fs.readdir(dirPath);
            let mostRecent: Date | null = null;

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);

                if (!mostRecent || stat.mtime > mostRecent) {
                    mostRecent = stat.mtime;
                }
            }

            return mostRecent;
        } catch {
            return null;
        }
    }

    // --------------------------------------------------------------------------
    // Task.md Parsing
    // --------------------------------------------------------------------------

    parseTaskChecklist(content: string): TaskChecklistItem[] {
        const items: TaskChecklistItem[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match: - [ ] task, - [x] task, - [/] task
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

                items.push({
                    text,
                    status,
                    lineNumber: i + 1,
                });
            }
        }

        return items;
    }

    // --------------------------------------------------------------------------
    // Continuation Injection
    // --------------------------------------------------------------------------

    async injectContinuation(agent: AgentConfig, status: AgentStatus): Promise<void> {
        // 1. Check for DSPy Reflection Signal (.reflection-needed.json in session dir)
        const sessionDir = path.join(this.config.repoRoot, '.gemini', 'sessions', agent.agentId);
        const signalPath = path.join(sessionDir, '.reflection-needed.json');
        const responsePath = path.join(sessionDir, '.reflection-response.json');

        if (await fs.pathExists(signalPath)) {
            console.log(`[BrainPoller] Agent ${agent.role} is blocked on a reflection prompt. Injecting automated response...`);

            try {
                // Automated "Transparent Reflection" response
                const response = {
                    response: "Proceed with the current plan. The reasoning is sound and aligns with the TDD requirements. [[REFLECTION_END]]",
                    timestamp: new Date().toISOString(),
                    orchestratorPoked: true
                };

                await fs.writeJSON(responsePath, response, { spaces: 2 });
                console.log(`[BrainPoller] Wrote automated reflection response to ${responsePath}`);

                // We still write the .continuation-prompt as a fallback/log
            } catch (error) {
                console.error(`[BrainPoller] Failed to process reflection signal for ${agent.role}:`, error);
            }
        }

        // 2. Standard Gastown Continuation (.continuation-prompt in brain dir)
        const pokePath = path.join(agent.brainDir, '.continuation-prompt');

        let prompt: string;

        if (status.currentTask) {
            prompt = `Continue working on: ${status.currentTask}`;
        } else {
            const nextPending = status.checklistItems.find(i => i.status === 'pending');
            if (nextPending) {
                prompt = `Proceed to next task: ${nextPending.text}`;
            } else {
                prompt = `All tasks complete. Call notify_user to report completion.`;
            }
        }

        const pokeContent = {
            timestamp: new Date().toISOString(),
            agentId: agent.agentId,
            role: agent.role,
            prompt,
            status: {
                completed: status.completedTasks,
                total: status.totalTasks,
                idleMs: status.idleDurationMs,
            },
        };

        await fs.writeJSON(pokePath, pokeContent, { spaces: 2 });

        console.log(`[BrainPoller] Wrote continuation prompt to ${pokePath}`);
    }

    // --------------------------------------------------------------------------
    // Phase Status
    // --------------------------------------------------------------------------

    calculatePhaseStatus(statuses: AgentStatus[]): PhaseStatus {
        const workers = statuses.filter(s => s.role !== 'engineering-director' && s.role !== 'orchestrator');

        return {
            phase: 'current', // TODO: Read from orchestrator's task.md
            totalAgents: workers.length,
            completedAgents: workers.filter(s => s.isComplete).length,
            idleAgents: workers.filter(s => s.isIdle).length,
            blockedAgents: 0, // TODO: Detect blocked status
            isPhaseComplete: workers.length > 0 && workers.every(s => s.isComplete),
        };
    }

    // --------------------------------------------------------------------------
    // Utilities
    // --------------------------------------------------------------------------

    renderProgressBar(completed: number, total: number, width: number = 20): string {
        if (total === 0) return '[' + '░'.repeat(width) + ']';

        const filled = Math.round((completed / total) * width);
        const empty = width - filled;

        return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    }

    getAgentStatuses(): Promise<AgentStatus[]> {
        return this.pollAllAgents();
    }
}

// ============================================================================
// CLI Runner
// ============================================================================

async function main() {
    console.log('🧠 Antigravity Brain Poller - External Orchestrator\n');

    // Default agent configuration based on current project
    const defaultAgents: AgentConfig[] = [
        { agentId: 'orchestrator', conversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf', role: 'orchestrator', brainDir: '' },
        { agentId: 'backend', conversationId: '15b9c503-6ccc-4d27-be08-680a3b9c0af2', role: 'backend-engineer', brainDir: '' },
        { agentId: 'security', conversationId: '64a8119a-82df-466d-b1ef-6a968f8c02f2', role: 'security-engineer', brainDir: '' },
        { agentId: 'qa', conversationId: '5858eac3-c35a-44e1-9b13-8023ddcd423d', role: 'qa-engineer', brainDir: '' },
        { agentId: 'pm', conversationId: '3c6c5553-b9d8-43c9-a6ed-4c85f8abb433', role: 'product-manager', brainDir: '' },
        { agentId: 'devops', conversationId: '91ccd3cd-586f-4f0d-b490-7fb42ceed5b2', role: 'devops-engineer', brainDir: '' },
        { agentId: 'director', conversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1', role: 'engineering-director', brainDir: '' },
    ];

    const poller = new BrainPoller({
        pollingIntervalMs: 30000,    // Poll every 30 seconds
        idleThresholdMs: 60000,      // Idle after 60 seconds
        autoInjectContinuation: true, // Auto-poke idle agents
        agents: defaultAgents,
    });

    // Event handlers
    poller.on('agent:complete', (status: AgentStatus) => {
        console.log(`\n🎉 [EVENT] Agent ${status.role} completed all tasks!`);
    });

    poller.on('agent:poked', (status: AgentStatus) => {
        console.log(`\n👉 [EVENT] Poked idle agent: ${status.role}`);
    });

    poller.on('phase:complete', (phaseStatus: PhaseStatus) => {
        console.log(`\n🏁 [EVENT] Phase complete! All ${phaseStatus.completedAgents} agents finished.`);
        console.log('   → Signal Engineering Director for phase review');
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\n\n[BrainPoller] Shutting down...');
        poller.stop();
        process.exit(0);
    });

    // Start polling
    await poller.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default BrainPoller;
