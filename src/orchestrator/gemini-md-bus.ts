/**
 * GEMINI.md Message Bus - Shared State Coordination
 * 
 * Uses ~/.gemini/GEMINI.md as a message bus for multi-agent coordination.
 * All agents read this file on wake-up and can see the orchestrator's dispatch queue.
 * 
 * Pattern: Option C from ANTIGRAVITY_INTERNALS.md
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface TaskDispatch {
    id: string;
    agent: string;
    description: string;
    status: 'pending' | 'dispatched' | 'in_progress' | 'blocked' | 'complete';
    storyFile?: string;
    dependencies?: string[];
    dispatchedAt?: string;
    completedAt?: string;
}

export interface PhaseState {
    phase: string;
    phaseDoc: string;
    status: 'planning' | 'in_progress' | 'review' | 'complete';
    startedAt: string;
    tasks: TaskDispatch[];
    lastUpdated: string;
}

export interface AgentHeartbeat {
    agentId: string;
    conversationId: string;
    role: string;
    status: 'idle' | 'working' | 'blocked' | 'complete';
    currentTask?: string;
    lastSeen: string;
}

export interface OrchestratorState {
    currentPhase: PhaseState;
    heartbeats: AgentHeartbeat[];
    lastOrchestratorPoll: string;
}

// ============================================================================
// GEMINI.md Manager
// ============================================================================

export class GeminiMdMessageBus {
    private geminiMdPath: string;
    private memoryKey = 'ORCHESTRATOR_DISPATCH';

    constructor(geminiMdPath?: string) {
        this.geminiMdPath = geminiMdPath ?? path.join(os.homedir(), '.gemini', 'GEMINI.md');
    }

    // --------------------------------------------------------------------------
    // Read/Write Operations
    // --------------------------------------------------------------------------

    async readGeminiMd(): Promise<string> {
        try {
            if (await fs.pathExists(this.geminiMdPath)) {
                return await fs.readFile(this.geminiMdPath, 'utf-8');
            }
            return '';
        } catch (error) {
            console.error(`[GeminiMd] Error reading GEMINI.md: ${error}`);
            return '';
        }
    }

    async writeGeminiMd(content: string): Promise<void> {
        await fs.ensureDir(path.dirname(this.geminiMdPath));
        await fs.writeFile(this.geminiMdPath, content, 'utf-8');
    }

    // --------------------------------------------------------------------------
    // Memory Block Operations
    // --------------------------------------------------------------------------

    extractMemoryBlock(content: string, key: string): string | null {
        const regex = new RegExp(`<MEMORY\\[${key}\\]>([\\s\\S]*?)</MEMORY\\[${key}\\]>`, 'm');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    }

    updateMemoryBlock(content: string, key: string, value: string): string {
        const regex = new RegExp(`<MEMORY\\[${key}\\]>[\\s\\S]*?</MEMORY\\[${key}\\]>`, 'm');
        const newBlock = `<MEMORY[${key}]>\n${value}\n</MEMORY[${key}]>`;

        if (regex.test(content)) {
            return content.replace(regex, newBlock);
        } else {
            // Append new memory block
            return content.trim() + '\n\n' + newBlock + '\n';
        }
    }

    // --------------------------------------------------------------------------
    // Orchestrator State Operations
    // --------------------------------------------------------------------------

    async getOrchestratorState(): Promise<OrchestratorState | null> {
        const content = await this.readGeminiMd();
        const block = this.extractMemoryBlock(content, this.memoryKey);

        if (!block) return null;

        try {
            return JSON.parse(block);
        } catch (error) {
            console.error(`[GeminiMd] Error parsing orchestrator state: ${error}`);
            return null;
        }
    }

    async setOrchestratorState(state: OrchestratorState): Promise<void> {
        const content = await this.readGeminiMd();
        const stateJson = JSON.stringify(state, null, 2);
        const updated = this.updateMemoryBlock(content, this.memoryKey, stateJson);
        await this.writeGeminiMd(updated);
        console.log(`[GeminiMd] Updated orchestrator state in ${this.geminiMdPath}`);
    }

    // --------------------------------------------------------------------------
    // Task Dispatch Operations
    // --------------------------------------------------------------------------

    async dispatchTask(task: TaskDispatch): Promise<void> {
        let state = await this.getOrchestratorState();

        if (!state) {
            state = this.createDefaultState();
        }

        // Add or update task
        const existingIndex = state.currentPhase.tasks.findIndex(t => t.id === task.id);
        if (existingIndex >= 0) {
            state.currentPhase.tasks[existingIndex] = task;
        } else {
            state.currentPhase.tasks.push(task);
        }

        state.currentPhase.lastUpdated = new Date().toISOString();
        state.lastOrchestratorPoll = new Date().toISOString();

        await this.setOrchestratorState(state);
    }

    async updateTaskStatus(taskId: string, status: TaskDispatch['status']): Promise<void> {
        const state = await this.getOrchestratorState();
        if (!state) return;

        const task = state.currentPhase.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = status;
            if (status === 'complete') {
                task.completedAt = new Date().toISOString();
            }
            state.currentPhase.lastUpdated = new Date().toISOString();
            await this.setOrchestratorState(state);
        }
    }

    async getTasksForAgent(agentRole: string): Promise<TaskDispatch[]> {
        const state = await this.getOrchestratorState();
        if (!state) return [];

        return state.currentPhase.tasks.filter(t => t.agent === agentRole);
    }

    // --------------------------------------------------------------------------
    // Heartbeat Operations
    // --------------------------------------------------------------------------

    async updateHeartbeat(heartbeat: AgentHeartbeat): Promise<void> {
        let state = await this.getOrchestratorState();

        if (!state) {
            state = this.createDefaultState();
        }

        const existingIndex = state.heartbeats.findIndex(h => h.agentId === heartbeat.agentId);
        if (existingIndex >= 0) {
            state.heartbeats[existingIndex] = heartbeat;
        } else {
            state.heartbeats.push(heartbeat);
        }

        await this.setOrchestratorState(state);
    }

    async getAgentHeartbeats(): Promise<AgentHeartbeat[]> {
        const state = await this.getOrchestratorState();
        return state?.heartbeats ?? [];
    }

    // --------------------------------------------------------------------------
    // Phase Operations
    // --------------------------------------------------------------------------

    async initializePhase(phase: string, phaseDoc: string, tasks: TaskDispatch[]): Promise<void> {
        const state: OrchestratorState = {
            currentPhase: {
                phase,
                phaseDoc,
                status: 'in_progress',
                startedAt: new Date().toISOString(),
                tasks,
                lastUpdated: new Date().toISOString(),
            },
            heartbeats: [],
            lastOrchestratorPoll: new Date().toISOString(),
        };

        await this.setOrchestratorState(state);
        console.log(`[GeminiMd] Initialized phase: ${phase} with ${tasks.length} tasks`);
    }

    async isPhaseComplete(): Promise<boolean> {
        const state = await this.getOrchestratorState();
        if (!state) return false;

        const tasks = state.currentPhase.tasks;
        return tasks.length > 0 && tasks.every(t => t.status === 'complete');
    }

    // --------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------

    private createDefaultState(): OrchestratorState {
        return {
            currentPhase: {
                phase: 'phase-2-context-injection',
                phaseDoc: 'docs/phases/phase-2-context-injection.md',
                status: 'in_progress',
                startedAt: new Date().toISOString(),
                tasks: [],
                lastUpdated: new Date().toISOString(),
            },
            heartbeats: [],
            lastOrchestratorPoll: new Date().toISOString(),
        };
    }
}

// ============================================================================
// CLI Functions
// ============================================================================

export async function initializePhase2(): Promise<void> {
    const bus = new GeminiMdMessageBus();

    const tasks: TaskDispatch[] = [
        {
            id: 'P2-001',
            agent: 'backend-engineer',
            description: 'Implement ContextInjector class',
            status: 'complete',
            storyFile: 'stories/state-bridge/20260107_context_injector.story.md',
        },
        {
            id: 'P2-002',
            agent: 'backend-engineer',
            description: 'Implement SessionDiscovery and recursive file search',
            status: 'pending',
            storyFile: 'stories/state-bridge/20260107_session_discovery.story.md',
            dependencies: ['P2-001'],
        },
        {
            id: 'P2-003',
            agent: 'backend-engineer',
            description: 'Implement SessionParser with version detection',
            status: 'pending',
            storyFile: 'stories/state-bridge/20260107_session_parser.story.md',
            dependencies: ['P2-002'],
        },
        {
            id: 'P2-004',
            agent: 'backend-engineer',
            description: 'Implement --ag-session CLI flag',
            status: 'pending',
            storyFile: 'stories/cli/20260107_continue_from_ag_command.story.md',
            dependencies: ['P2-003'],
        },
        {
            id: 'P2-005',
            agent: 'security-engineer',
            description: 'Security review of context injection and path traversal',
            status: 'pending',
            storyFile: 'stories/security/20260107_context_security_review.story.md',
            dependencies: ['P2-004'],
        },
        {
            id: 'P2-006',
            agent: 'qa-engineer',
            description: 'Integration tests for state bridge components',
            status: 'pending',
            storyFile: 'stories/qa/20260107_context_integration_tests.story.md',
            dependencies: ['P2-005'],
        },
    ];

    await bus.initializePhase('phase-2-state-bridge', 'docs/phases/phase-2-context-injection.md', tasks);

    console.log('\n✅ Phase 2 initialized in GEMINI.md');
    console.log('Tasks:');
    for (const task of tasks) {
        const statusIcon = task.status === 'complete' ? '✅' : '⬜';
        console.log(`  ${statusIcon} ${task.id}: ${task.agent} - ${task.description}`);
    }
}

// Run if executed directly
if (require.main === module) {
    initializePhase2().catch(console.error);
}

export default GeminiMdMessageBus;
