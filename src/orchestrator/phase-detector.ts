/**
 * Phase Completion Detector
 * 
 * Monitors agent progress and triggers Engineering Director review
 * when all tasks in a phase are marked complete.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
    BrainPoller,
    AgentConfig,
    AgentStatus,
    OrchestratorState,
    ContinuationPrompt,
    injectViaFile
} from './index';
import { GeminiMdMessageBus } from './gemini-md-bus';

export interface PhaseCompletionConfig {
    pollingIntervalMs: number;
    repoRoot: string;
    directorConversationId: string;
    orchestratorConversationId: string;
    workers: AgentConfig[];
}

export interface PhaseCompletionEvent {
    phase: string;
    completedTasks: number;
    totalTasks: number;
    completionTime: Date;
    workerStatuses: AgentStatus[];
}

// ============================================================================
// Phase Completion Detector
// ============================================================================

export class PhaseCompletionDetector extends EventEmitter {
    private config: PhaseCompletionConfig;
    private brainPoller: BrainPoller;
    private messageBus: GeminiMdMessageBus;
    private running: boolean = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastPhaseComplete: boolean = false;

    constructor(config: PhaseCompletionConfig) {
        super();
        this.config = config;

        this.brainPoller = new BrainPoller({
            pollingIntervalMs: config.pollingIntervalMs,
            idleThresholdMs: 60000,
            autoInjectContinuation: true,
            repoRoot: config.repoRoot,
            agents: config.workers,
        });

        this.messageBus = new GeminiMdMessageBus();

        // Forward events from brain poller
        this.brainPoller.on('agent:complete', (status: AgentStatus) => {
            this.emit('agent:complete', status);
            this.emit('worker:complete', status);
        });
    }

    // --------------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------------

    async start(): Promise<void> {
        if (this.running) return;

        this.running = true;
        console.log('[PhaseDetector] Starting phase completion monitoring...');

        // Start brain poller
        await this.brainPoller.start();

        // Check phase completion on interval
        this.pollInterval = setInterval(async () => {
            await this.checkPhaseCompletion();
        }, this.config.pollingIntervalMs);
    }

    stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.brainPoller.stop();
        this.running = false;
        console.log('[PhaseDetector] Stopped');
    }

    // --------------------------------------------------------------------------
    // Phase Completion Logic
    // --------------------------------------------------------------------------

    async checkPhaseCompletion(): Promise<void> {
        // Get current worker statuses
        const statuses = await this.brainPoller.getAgentStatuses();

        // Get orchestrator state from GEMINI.md
        const orchestratorState = await this.messageBus.getOrchestratorState();
        if (!orchestratorState) {
            console.log('[PhaseDetector] No orchestrator state found in GEMINI.md');
            return;
        }

        const tasks = orchestratorState.currentPhase.tasks;
        const completedTasks = tasks.filter(t => t.status === 'complete').length;
        const totalTasks = tasks.length;

        // Check if all tasks are complete
        const isComplete = totalTasks > 0 && completedTasks === totalTasks;

        // Avoid duplicate notifications
        if (isComplete && !this.lastPhaseComplete) {
            this.lastPhaseComplete = true;

            console.log(`\n🏁 [PhaseDetector] PHASE COMPLETE! All ${totalTasks} tasks finished.`);

            const event: PhaseCompletionEvent = {
                phase: orchestratorState.currentPhase.phase,
                completedTasks,
                totalTasks,
                completionTime: new Date(),
                workerStatuses: statuses,
            };

            // Emit event
            this.emit('phase:complete', event);

            // Notify Engineering Director
            await this.notifyDirector(event, orchestratorState);

        } else if (!isComplete) {
            this.lastPhaseComplete = false;

            // Log progress
            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            console.log(`[PhaseDetector] Phase progress: ${completedTasks}/${totalTasks} (${progressPct}%)`);
        }
    }

    // --------------------------------------------------------------------------
    // Director Notification
    // --------------------------------------------------------------------------

    async notifyDirector(event: PhaseCompletionEvent, state: OrchestratorState): Promise<void> {
        console.log('[PhaseDetector] Notifying Engineering Director for phase review...');

        // Create continuation prompt for director
        const prompt: ContinuationPrompt = {
            agentId: 'director',
            conversationId: this.config.directorConversationId,
            prompt: `
🏁 PHASE COMPLETE - REVIEW REQUIRED

Phase: ${event.phase}
Completed: ${event.completedTasks}/${event.totalTasks} tasks
Time: ${event.completionTime.toISOString()}

Tasks completed:
${state.currentPhase.tasks.map(t => `- ${t.id}: ${t.agent} - ${t.description} (${t.status})`).join('\n')}

Please review the completed work and issue phase approval/veto JSON:

{
  "action": "phase_approval",
  "phase": "${event.phase}",
  "decision": "approved" | "vetoed" | "revision_requested",
  "review_notes": "...",
  "next_phase": "phase-3-oauth-credentials"
}
      `.trim(),
            context: {
                completedTasks: event.completedTasks,
                totalTasks: event.totalTasks,
            },
        };

        // Write continuation prompt to director's brain directory
        const result = await injectViaFile(this.config.directorConversationId, prompt);

        if (result.success) {
            console.log('[PhaseDetector] ✅ Director notified via continuation prompt');
        } else {
            console.error('[PhaseDetector] ❌ Failed to notify director:', result.message);
        }

        // Also update GEMINI.md with phase status
        state.currentPhase.status = 'review';
        state.currentPhase.lastUpdated = new Date().toISOString();
        await this.messageBus.setOrchestratorState(state);
    }

    // --------------------------------------------------------------------------
    // Manual Trigger
    // --------------------------------------------------------------------------

    async triggerDirectorReview(): Promise<void> {
        const state = await this.messageBus.getOrchestratorState();
        if (!state) {
            console.error('[PhaseDetector] No orchestrator state found');
            return;
        }

        const tasks = state.currentPhase.tasks;
        const event: PhaseCompletionEvent = {
            phase: state.currentPhase.phase,
            completedTasks: tasks.filter(t => t.status === 'complete').length,
            totalTasks: tasks.length,
            completionTime: new Date(),
            workerStatuses: [],
        };

        await this.notifyDirector(event, state);
    }
}

// ============================================================================
// CLI Runner
// ============================================================================

async function main() {
    console.log('🔍 Phase Completion Detector\n');

    const repoRoot = path.join(os.homedir(), 'workspace', 'dspy', 'cc-mirror-ag-state-bridge');

    const detector = new PhaseCompletionDetector({
        pollingIntervalMs: 30000,
        repoRoot,
        directorConversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1',
        orchestratorConversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf',
        workers: [
            { agentId: 'backend', conversationId: '15b9c503-6ccc-4d27-be08-680a3b9c0af2', role: 'backend-engineer', brainDir: '' },
            { agentId: 'security', conversationId: '64a8119a-82df-466d-b1ef-6a968f8c02f2', role: 'security-engineer', brainDir: '' },
            { agentId: 'qa', conversationId: '5858eac3-c35a-44e1-9b13-8023ddcd423d', role: 'qa-engineer', brainDir: '' },
            { agentId: 'devops', conversationId: '91ccd3cd-586f-4f0d-b490-7fb42ceed5b2', role: 'devops-engineer', brainDir: '' },
        ],
    });

    // Event handlers
    detector.on('worker:complete', (status: AgentStatus) => {
        console.log(`\n🎉 [EVENT] Worker ${status.role} completed all tasks!`);
    });

    detector.on('phase:complete', (event: PhaseCompletionEvent) => {
        console.log(`\n🏁 [EVENT] Phase ${event.phase} complete!`);
        console.log(`   Tasks: ${event.completedTasks}/${event.totalTasks}`);
        console.log('   → Director review triggered');
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\n\n[PhaseDetector] Shutting down...');
        detector.stop();
        process.exit(0);
    });

    // Start monitoring
    await detector.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default PhaseCompletionDetector;
