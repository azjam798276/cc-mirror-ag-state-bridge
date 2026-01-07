
import { PhaseCompletionDetector, PhaseCompletionConfig } from '../../../src/orchestrator/phase-detector';
import { BrainPoller } from '../../../src/orchestrator/brain-poller';
import { GeminiMdMessageBus, OrchestratorState } from '../../../src/orchestrator/gemini-md-bus';
import { injectViaFile } from '../../../src/orchestrator/index';

// Mock dependencies
jest.mock('../../../src/orchestrator/brain-poller');
jest.mock('../../../src/orchestrator/gemini-md-bus');
jest.mock('../../../src/orchestrator/index', () => ({
    injectViaFile: jest.fn(),
    BrainPoller: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        getAgentStatuses: jest.fn(),
    })),
    // Re-export types if needed by runtime (usually not needed for jest mocks of types)
}));

describe('PhaseCompletionDetector', () => {
    let detector: PhaseCompletionDetector;
    let mockPoller: any;
    let mockBus: any;

    const config: PhaseCompletionConfig = {
        pollingIntervalMs: 100,
        repoRoot: '/mock/repo',
        directorConversationId: 'director-id',
        orchestratorConversationId: 'orch-id',
        workers: []
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup internal mocks
        detector = new PhaseCompletionDetector(config);

        // Access private properties via casting to any
        mockPoller = (detector as any).brainPoller;
        mockBus = (detector as any).messageBus;
    });

    afterEach(() => {
        detector.stop();
    });

    describe('Lifecycle', () => {
        it('should start and stop polling', async () => {
            await detector.start();
            expect(mockPoller.start).toHaveBeenCalled();
            expect((detector as any).running).toBe(true);

            detector.stop();
            expect(mockPoller.stop).toHaveBeenCalled();
            expect((detector as any).running).toBe(false);
        });

        it('should not start if already running', async () => {
            await detector.start();
            await detector.start();
            expect(mockPoller.start).toHaveBeenCalledTimes(1);
        });
    });

    describe('checkPhaseCompletion', () => {
        const mockState: OrchestratorState = {
            currentPhase: {
                phase: 'test-phase',
                phaseDoc: 'doc',
                status: 'in_progress',
                startedAt: 'now',
                tasks: [
                    { id: 'T1', agent: 'A1', description: 'D1', status: 'complete' },
                    { id: 'T2', agent: 'A2', description: 'D2', status: 'pending' }
                ],
                lastUpdated: 'now'
            },
            heartbeats: [],
            lastOrchestratorPoll: 'now'
        };

        it('should log if no state found', async () => {
            mockBus.getOrchestratorState.mockResolvedValue(null);

            await detector.checkPhaseCompletion(); // Should exit early

            expect(injectViaFile).not.toHaveBeenCalled();
        });

        it('should detect incomplete phase', async () => {
            mockBus.getOrchestratorState.mockResolvedValue(mockState);
            mockPoller.getAgentStatuses.mockResolvedValue([]);

            await detector.checkPhaseCompletion();

            expect(injectViaFile).not.toHaveBeenCalled();
            expect((detector as any).lastPhaseComplete).toBe(false);
        });

        it('should detect complete phase and notify', async () => {
            const completeState = JSON.parse(JSON.stringify(mockState));
            completeState.currentPhase.tasks[1].status = 'complete'; // All complete

            mockBus.getOrchestratorState.mockResolvedValue(completeState);
            mockPoller.getAgentStatuses.mockResolvedValue([]);
            (injectViaFile as jest.Mock).mockResolvedValue({ success: true });

            const emitSpy = jest.spyOn(detector, 'emit');

            await detector.checkPhaseCompletion();

            expect(emitSpy).toHaveBeenCalledWith('phase:complete', expect.anything());
            expect(injectViaFile).toHaveBeenCalledWith(
                config.directorConversationId,
                expect.objectContaining({ agentId: 'director' })
            );
            expect(mockBus.setOrchestratorState).toHaveBeenCalled();
            expect((detector as any).lastPhaseComplete).toBe(true);
        });

        it('should not notify duplicates', async () => {
            const completeState = JSON.parse(JSON.stringify(mockState));
            completeState.currentPhase.tasks[1].status = 'complete';

            mockBus.getOrchestratorState.mockResolvedValue(completeState);
            mockPoller.getAgentStatuses.mockResolvedValue([]);

            // First call
            await detector.checkPhaseCompletion();
            // Second call
            await detector.checkPhaseCompletion();

            expect(injectViaFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('triggerDirectorReview', () => {
        it('should notify director manually', async () => {
            const mockState: OrchestratorState = {
                currentPhase: {
                    phase: 'test-phase',
                    phaseDoc: 'doc',
                    status: 'in_progress',
                    startedAt: 'now',
                    tasks: [],
                    lastUpdated: 'now'
                },
                heartbeats: [],
                lastOrchestratorPoll: 'now'
            };
            mockBus.getOrchestratorState.mockResolvedValue(mockState);
            (injectViaFile as jest.Mock).mockResolvedValue({ success: true });

            await detector.triggerDirectorReview();

            expect(injectViaFile).toHaveBeenCalled();
        });
    });
});
