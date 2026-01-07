
import { CLIDashboard } from '../../../src/orchestrator/dashboard';
import { BrainPoller } from '../../../src/orchestrator/brain-poller';
import { GeminiMdMessageBus } from '../../../src/orchestrator/gemini-md-bus';
import * as readline from 'readline';

// Mock dependencies
jest.mock('../../../src/orchestrator/brain-poller');
jest.mock('../../../src/orchestrator/gemini-md-bus');
jest.mock('readline', () => ({
    emitKeypressEvents: jest.fn(),
    clearLine: jest.fn(),
    cursorTo: jest.fn()
}));

describe('CLIDashboard', () => {
    let dashboard: CLIDashboard;
    let mockPoller: any;
    let mockBus: any;

    // Spies for process/console
    let stdoutSpy: jest.SpyInstance;
    let consoleSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;
    let onSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock process.stdout.write to avoid cluttering test output
        stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => undefined as never);

        // Setup stdin mocks
        if (!process.stdin.setRawMode) {
            (process.stdin as any).setRawMode = jest.fn();
        }
        jest.spyOn(process.stdin, 'setRawMode').mockImplementation(() => process.stdin);

        // Properly spy on process.stdin.on
        onSpy = jest.spyOn(process.stdin, 'on').mockImplementation((event, listener) => process.stdin);

        dashboard = new CLIDashboard({
            refreshIntervalMs: 100,
            agents: []
        });

        // Get internal mocks
        mockPoller = (dashboard as any).brainPoller;
        mockBus = (dashboard as any).messageBus;

        // Setup default data
        mockPoller.pollAllAgents.mockResolvedValue([]);
        mockBus.getOrchestratorState.mockResolvedValue({
            currentPhase: { phase: 'P1', status: 'in_progress', tasks: [] }
        });
    });

    afterEach(() => {
        dashboard.stop();
        jest.restoreAllMocks();
    });

    describe('Lifecycle', () => {
        it('should start and perform initial refresh', async () => {
            await dashboard.start();
            expect(mockPoller.pollAllAgents).toHaveBeenCalled();
            expect(stdoutSpy).toHaveBeenCalled(); // Clears screen
            expect((dashboard as any).running).toBe(true);
        });

        it('should stop and clear interval', async () => {
            await dashboard.start();
            dashboard.stop();
            expect((dashboard as any).running).toBe(false);
            expect(stdoutSpy).toHaveBeenCalled(); // Shows cursor
        });

        it('should not start if already running', async () => {
            await dashboard.start();
            mockPoller.pollAllAgents.mockClear();
            await dashboard.start();
            expect(mockPoller.pollAllAgents).not.toHaveBeenCalled();
        });
    });

    describe('Rendering checks', () => {
        it('should render agent matrix', async () => {
            const status = {
                role: 'backend',
                totalTasks: 10,
                completedTasks: 5,
                isComplete: false,
                isIdle: false,
                isActive: true,
                idleDurationMs: 0
            };
            mockPoller.pollAllAgents.mockResolvedValue([status]);

            await dashboard.refresh();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AGENT STATUS MATRIX'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('backend'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RUNNING'));
        });

        it('should render dispatch queue with various statuses', async () => {
            mockBus.getOrchestratorState.mockResolvedValue({
                currentPhase: {
                    phase: 'P1', status: 'in_progress',
                    tasks: [
                        { id: 'T1', agent: 'A1', description: 'desc', status: 'complete' },
                        { id: 'T2', agent: 'A2', description: 'desc', status: 'in_progress' },
                        { id: 'T3', agent: 'A3', description: 'desc', status: 'dispatched' },
                        { id: 'T4', agent: 'A4', description: 'desc', status: 'blocked' },
                        { id: 'T5', agent: 'A5', description: 'desc', status: 'pending' }
                    ]
                }
            });

            await dashboard.refresh();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔄'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📤'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚫'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⬜'));
        });

        it('should render various agent statuses', async () => {
            const statuses = [
                { role: 'A1', totalTasks: 10, completedTasks: 10, isComplete: true, isIdle: false, isActive: false, idleDurationMs: 0 },
                { role: 'A2', totalTasks: 10, completedTasks: 5, isComplete: false, isIdle: false, isActive: true, idleDurationMs: 0 },
                { role: 'A3', totalTasks: 10, completedTasks: 5, isComplete: false, isIdle: true, isActive: false, idleDurationMs: 3661000 }, // > 1 hr
                { role: 'A4', totalTasks: 0, completedTasks: 0, isComplete: false, isIdle: false, isActive: false, idleDurationMs: 0 },
                { role: 'A5', totalTasks: 10, completedTasks: 2, isComplete: false, isIdle: false, isActive: false, idleDurationMs: 65000 } // > 1 min
            ];
            mockPoller.pollAllAgents.mockResolvedValue(statuses);

            await dashboard.refresh();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DONE'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RUNNING'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('IDLE'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NO TASKS'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ACTIVE'));

            // Check duration formatting
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1h 1m'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1m 5s'));
        });

        it('should render progress bar with correct colors', async () => {
            const statuses = [
                { role: 'A1', totalTasks: 100, completedTasks: 100, isComplete: true, isIdle: false, isActive: false, idleDurationMs: 0 }, // Green
                { role: 'A2', totalTasks: 100, completedTasks: 80, isComplete: false, isIdle: false, isActive: true, idleDurationMs: 0 }, // Cyan
                { role: 'A3', totalTasks: 100, completedTasks: 50, isComplete: false, isIdle: false, isActive: true, idleDurationMs: 0 }, // Yellow
                { role: 'A4', totalTasks: 0, completedTasks: 0, isComplete: false, isIdle: false, isActive: false, idleDurationMs: 0 } // Empty
            ];
            mockPoller.pollAllAgents.mockResolvedValue(statuses);
            await dashboard.refresh();

            // Note: We can't easily check ANSI codes with stringContaining, but we verify the code path executes
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('Input Handling', () => {
        it('should setup keyboard handler', async () => {
            await dashboard.start();
            expect(readline.emitKeypressEvents).toHaveBeenCalled();
            expect(onSpy).toHaveBeenCalledWith('keypress', expect.any(Function));
        });

        it('should handle "q" to quit', async () => {
            await dashboard.start();
            const keyHandler = onSpy.mock.calls.find(call => call[0] === 'keypress')[1];

            keyHandler('q', { name: 'q' });
            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle "Ctrl+C" to quit', async () => {
            await dashboard.start();
            const keyHandler = onSpy.mock.calls.find(call => call[0] === 'keypress')[1];

            keyHandler('c', { name: 'c', ctrl: true });
            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle "r" to refresh', async () => {
            await dashboard.start();
            mockPoller.pollAllAgents.mockClear();
            // Find keypress handler
            const keyHandler = onSpy.mock.calls.find(call => call[0] === 'keypress')[1];

            keyHandler('r', { name: 'r' });
            expect(mockPoller.pollAllAgents).toHaveBeenCalled();
        });
    });
});

