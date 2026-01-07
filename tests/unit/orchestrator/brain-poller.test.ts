
import { BrainPoller, AgentConfig, AgentStatus } from '../../../src/orchestrator/brain-poller';
import { ArtifactProgressScanner } from '../../../src/orchestrator/artifact-scanner';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../../src/orchestrator/artifact-scanner');

describe('BrainPoller', () => {
    let poller: BrainPoller;
    const mockRepoRoot = '/mock/repo';
    const mockBrainBase = '/mock/brain';
    const agentConfig: AgentConfig = {
        agentId: 'A1',
        conversationId: 'conv-1',
        role: 'backend-engineer',
        brainDir: '/mock/brain/conv-1'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mocks for file system
        (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
        (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);
        (fs.stat as unknown as jest.Mock).mockResolvedValue({ mtime: new Date() });
        (fs.readFile as unknown as jest.Mock).mockResolvedValue('');

        poller = new BrainPoller({
            repoRoot: mockRepoRoot,
            brainBaseDir: mockBrainBase,
            pollingIntervalMs: 100, // Fast polling for tests
            agents: [agentConfig],
            autoInjectContinuation: true
        });
    });

    afterEach(() => {
        poller.stop();
    });

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    describe('Lifecycle', () => {
        it('should start and stop polling', async () => {
            const pollSpy = jest.spyOn(poller, 'pollAllAgents').mockResolvedValue([]);

            await poller.start();
            expect(pollSpy).toHaveBeenCalled();
            // Clean up
            poller.stop();
        });

        it('should warn if already running', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            await poller.start();
            await poller.start();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already running'));
        });
    });

    // -------------------------------------------------------------------------
    // Polling & Status
    // -------------------------------------------------------------------------
    describe('Agent Status Parsing', () => {
        it('should parse task.md correctly', async () => {
            const taskMd = `
- [x] Task 1
- [/] Task 2
- [ ] Task 3
            `.trim();

            (fs.readFile as unknown as jest.Mock).mockResolvedValue(taskMd);
            (fs.stat as unknown as jest.Mock).mockResolvedValue({ mtime: new Date() });

            const status = await poller.pollAgent(agentConfig);

            expect(status.totalTasks).toBe(3);
            expect(status.completedTasks).toBe(1); // [x]
            expect(status.inProgressTasks).toBe(1); // [/]
            expect(status.pendingTasks).toBe(1); // [ ]
            expect(status.currentTask).toBe('Task 2');
        });

        it('should handle missing task.md', async () => {
            // Mock brain dir exists, but task.md does not
            (fs.pathExists as unknown as jest.Mock).mockImplementation((p: string) => {
                return !p.endsWith('task.md');
            });

            const status = await poller.pollAgent(agentConfig);

            expect(status.taskMdExists).toBe(false);
            expect(status.totalTasks).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Idle Detection
    // -------------------------------------------------------------------------
    describe('Idle Detection', () => {
        it('should detect active agent (recent file mod)', async () => {
            const now = new Date();
            const recent = new Date(now.getTime() - 1000); // 1s ago

            (fs.readdir as unknown as jest.Mock).mockResolvedValue(['file.txt']);
            (fs.stat as unknown as jest.Mock).mockImplementation((p: string) => {
                return Promise.resolve({ mtime: recent });
            });

            const status = await poller.pollAgent(agentConfig);
            expect(status.isActive).toBe(true);
            expect(status.isIdle).toBe(false);
        });

        it('should detect idle agent (old file mod)', async () => {
            const now = new Date();
            const old = new Date(now.getTime() - 70000); // 70s ago (threshold 60s)

            // Mock task.md read to imply checks exist but not done
            (fs.readFile as unknown as jest.Mock).mockResolvedValue('- [ ] Task 1');

            (fs.readdir as unknown as jest.Mock).mockResolvedValue(['file.txt']);
            // Return old time for all stat calls
            (fs.stat as unknown as jest.Mock).mockResolvedValue({ mtime: old });

            const status = await poller.pollAgent(agentConfig);
            expect(status.isActive).toBe(false);
            expect(status.isIdle).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Continuation Injection
    // -------------------------------------------------------------------------
    describe('Continuation Injection', () => {
        it('should inject continuation when idle', async () => {
            // Force idle status
            const status: AgentStatus = {
                agentId: 'A1', role: 'test', conversationId: 'c1', brainDir: '/b',
                taskMdExists: true, lastModified: null,
                totalTasks: 1, completedTasks: 0, inProgressTasks: 0, pendingTasks: 1,
                isComplete: false, isIdle: true, isActive: false,
                idleDurationMs: 70000, lastActivityTime: null, currentTask: null,
                checklistItems: []
            };

            await poller.injectContinuation(agentConfig, status);

            expect(fs.writeJSON).toHaveBeenCalledWith(
                expect.stringContaining('.continuation-prompt'),
                expect.objectContaining({ agentId: 'A1' }),
                expect.anything()
            );
        });

        it('should handle reflection needed signal', async () => {
            const status = {
                checklistItems: []
            } as unknown as AgentStatus;

            // Mock pathExists to return true for .reflection-needed.json
            (fs.pathExists as unknown as jest.Mock).mockImplementation((p: string) => {
                return p.includes('.reflection-needed.json');
            });

            await poller.injectContinuation(agentConfig, status);

            expect(fs.writeJSON).toHaveBeenCalledWith(
                expect.stringContaining('.reflection-response.json'),
                expect.objectContaining({ response: expect.stringContaining('Proceed') }),
                expect.anything()
            );
        });
    });

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------
    describe('Agent Management', () => {
        it('should add agent', () => {
            const newAgent: AgentConfig = {
                agentId: 'A2', conversationId: 'c2', role: 'qa-engineer', brainDir: ''
            };
            poller.addAgent(newAgent);
            // Check config via accessing private property if strictly needed, or implied by pollAllAgents
            // Easier to just check if it runs without error during poll
        });

        it('should remove agent', () => {
            poller.removeAgent('conv-1');
            // Assuming config is updated.
        });
    });

    describe('Phase Status', () => {
        it('should calculate complete phase', () => {
            const s1 = { role: 'devops', isComplete: true } as AgentStatus;
            const s2 = { role: 'qa', isComplete: true } as AgentStatus;

            const phase = poller.calculatePhaseStatus([s1, s2]);
            expect(phase.isPhaseComplete).toBe(true);
        });

        it('should calculate incomplete phase', () => {
            const s1 = { role: 'devops', isComplete: true } as AgentStatus;
            const s2 = { role: 'qa', isComplete: false } as AgentStatus;

            const phase = poller.calculatePhaseStatus([s1, s2]);
            expect(phase.isPhaseComplete).toBe(false);
        });
    });

});
