/**
 * Orchestrator Module - External Coordination for Antigravity Agents
 * 
 * This module provides tools for coordinating multiple Antigravity IDE
 * agent conversations using the Gastown MEOW protocol.
 * 
 * Components:
 * - BrainPoller: Monitors agent brain directories for progress/idle detection
 * - AntigravityAPI: Injects continuation prompts to keep agents active
 * - GeminiMdMessageBus: Shared state coordination via ~/.gemini/GEMINI.md
 * - PhaseCompletionDetector: Triggers Director review when phase completes
 */

export { BrainPoller, AgentConfig, AgentStatus, OrchestratorConfig } from './brain-poller';
export {
    injectViaFile,
    injectViaCLI,
    injectContinuation,
    wakeIdleAgents,
    consumeContinuationPrompt,
    ContinuationPrompt,
    InjectionResult
} from './antigravity-api';
export {
    GeminiMdMessageBus,
    TaskDispatch,
    PhaseState,
    OrchestratorState,
    AgentHeartbeat,
    initializePhase2
} from './gemini-md-bus';
export {
    PhaseCompletionDetector,
    PhaseCompletionConfig,
    PhaseCompletionEvent
} from './phase-detector';
export {
    ArtifactReader,
    AgentArtifacts,
    ParsedWalkthrough,
    ParsedTaskMd,
    AggregatedPhaseReport
} from './artifact-reader';
export {
    CLIDashboard,
    DashboardConfig
} from './dashboard';
export {
    WalkthroughAggregator,
    WalkthroughSummary,
    CompletionCertificate,
    PhaseMetrics
} from './walkthrough-aggregator';

// Quick start helper
import BrainPoller from './brain-poller';
import PhaseCompletionDetector from './phase-detector';
import * as path from 'path';
import * as os from 'os';

// Default agent configuration for cc-mirror project
export const CC_MIRROR_AGENTS = [
    { agentId: 'orchestrator', conversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf', role: 'orchestrator' as const, brainDir: '' },
    { agentId: 'backend', conversationId: '455e1593-67ee-4e67-8def-2c740d9126c9', role: 'backend-engineer' as const, brainDir: '' },
    { agentId: 'security', conversationId: 'd8b5d68c-ad2c-4a54-aaa6-5b5226562348', role: 'security-engineer' as const, brainDir: '' },
    { agentId: 'qa', conversationId: 'bae2b5ff-5121-47b7-b637-8d9e5c3796cd', role: 'qa-engineer' as const, brainDir: '' },
    { agentId: 'pm', conversationId: '3c6c5553-b9d8-43c9-a6ed-4c85f8abb433', role: 'product-manager' as const, brainDir: '' },
    { agentId: 'devops', conversationId: '912ae322-48d1-43d4-be42-757a8b35e7e6', role: 'devops-engineer' as const, brainDir: '' },
    { agentId: 'director', conversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1', role: 'engineering-director' as const, brainDir: '' },
];

/**
 * Create a pre-configured brain poller for cc-mirror agents
 */
export function createCCMirrorPoller(): BrainPoller {
    return new BrainPoller({
        pollingIntervalMs: 30000,
        idleThresholdMs: 60000,
        autoInjectContinuation: true,
        repoRoot: path.join(os.homedir(), 'workspace', 'dspy', 'cc-mirror-ag-state-bridge'),
        agents: CC_MIRROR_AGENTS,
    });
}

/**
 * Create a pre-configured phase detector for cc-mirror agents
 */
export function createCCMirrorPhaseDetector(): PhaseCompletionDetector {
    const workers = CC_MIRROR_AGENTS.filter(a =>
        a.role !== 'orchestrator' && a.role !== 'engineering-director'
    );

    return new PhaseCompletionDetector({
        pollingIntervalMs: 30000,
        repoRoot: path.join(os.homedir(), 'workspace', 'dspy', 'cc-mirror-ag-state-bridge'),
        directorConversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1',
        orchestratorConversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf',
        workers,
    });
}
