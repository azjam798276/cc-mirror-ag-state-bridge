
import { GeminiMdMessageBus, TaskDispatch, OrchestratorState, AgentHeartbeat, initializePhase2 } from '../../../src/orchestrator/gemini-md-bus';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('fs-extra');

describe('GeminiMdMessageBus', () => {
    let bus: GeminiMdMessageBus;
    const mockPath = '/mock/.gemini/GEMINI.md';

    beforeEach(() => {
        jest.clearAllMocks();
        bus = new GeminiMdMessageBus(mockPath);
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    // -------------------------------------------------------------------------
    // Core Read/Write
    // -------------------------------------------------------------------------
    describe('readGeminiMd', () => {
        it('should return content if file exists', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue('data');
            const content = await bus.readGeminiMd();
            expect(content).toBe('data');
        });

        it('should return empty string if file missing', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
            const content = await bus.readGeminiMd();
            expect(content).toBe('');
        });

        it('should return empty string on error', async () => {
            (fs.pathExists as unknown as jest.Mock).mockRejectedValue(new Error('Access denied'));
            const content = await bus.readGeminiMd();
            expect(content).toBe('');
        });
    });

    describe('writeGeminiMd', () => {
        it('should ensure dir and write file', async () => {
            await bus.writeGeminiMd('content');
            expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(mockPath));
            expect(fs.writeFile).toHaveBeenCalledWith(mockPath, 'content', 'utf-8');
        });
    });

    // -------------------------------------------------------------------------
    // Memory Block Logic
    // -------------------------------------------------------------------------
    describe('Memory Block Operations', () => {
        it('should extract existing memory block', () => {
            const content = 'Pre\n<MEMORY[TEST]>foo</MEMORY[TEST]>\nPost';
            expect(bus.extractMemoryBlock(content, 'TEST')).toBe('foo');
        });

        it('should return null if block missing', () => {
            expect(bus.extractMemoryBlock('No block here', 'TEST')).toBeNull();
        });

        it('should update existing block', () => {
            const content = 'Pre\n<MEMORY[TEST]>old</MEMORY[TEST]>\nPost';
            const updated = bus.updateMemoryBlock(content, 'TEST', 'new');
            expect(updated).toContain('<MEMORY[TEST]>\nnew\n</MEMORY[TEST]>');
            expect(updated).not.toContain('old');
        });

        it('should append new block if missing', () => {
            const content = 'Original';
            const updated = bus.updateMemoryBlock(content, 'TEST', 'new');
            expect(updated).toContain('Original');
            expect(updated).toContain('<MEMORY[TEST]>\nnew\n</MEMORY[TEST]>');
        });
    });

    // -------------------------------------------------------------------------
    // Orchestrator State
    // -------------------------------------------------------------------------
    describe('Orchestrator State', () => {
        const mockState: OrchestratorState = {
            currentPhase: {
                phase: 'test',
                phaseDoc: 'doc',
                status: 'in_progress',
                startedAt: 'now',
                tasks: [],
                lastUpdated: 'now'
            },
            heartbeats: [],
            lastOrchestratorPoll: 'now'
        };

        const mockBlock = `<MEMORY[ORCHESTRATOR_DISPATCH]>\n${JSON.stringify(mockState)}\n</MEMORY[ORCHESTRATOR_DISPATCH]>`;

        it('should get state from file', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(mockBlock);

            const state = await bus.getOrchestratorState();
            expect(state).toEqual(mockState);
        });

        it('should return null if block invalid json', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue('<MEMORY[ORCHESTRATOR_DISPATCH]>{bad}</MEMORY[ORCHESTRATOR_DISPATCH]>');

            const state = await bus.getOrchestratorState();
            expect(state).toBeNull();
        });

        it('should set state by updating block', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(''); // Empty file initially

            await bus.setOrchestratorState(mockState);

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockPath,
                expect.stringContaining(JSON.stringify(mockState, null, 2)),
                'utf-8'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Task Dispatch
    // -------------------------------------------------------------------------
    describe('Task Operations', () => {
        const existingState: OrchestratorState = {
            currentPhase: {
                phase: 'test', phaseDoc: 'doc', status: 'in_progress', startedAt: 'now',
                tasks: [{ id: 'T1', agent: 'A1', description: 'Desc', status: 'pending' }],
                lastUpdated: 'now'
            },
            heartbeats: [], lastOrchestratorPoll: 'now'
        };
        const block = `<MEMORY[ORCHESTRATOR_DISPATCH]>${JSON.stringify(existingState)}</MEMORY[ORCHESTRATOR_DISPATCH]>`;

        it('dispatchTask should init default state if none exists', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false); // No file

            const task: TaskDispatch = { id: 'T2', agent: 'A2', description: 'Desc', status: 'pending' };
            await bus.dispatchTask(task);

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockPath,
                expect.stringContaining('phase-2-context-injection'), // Default state
                'utf-8'
            );
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockPath,
                expect.stringContaining('T2'),
                'utf-8'
            );
        });

        it('dispatchTask should add new task to existing state', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            const task: TaskDispatch = { id: 'T2', agent: 'A1', description: 'Desc', status: 'pending' };
            await bus.dispatchTask(task);

            // Verify write call contains the new task
            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('"id": "T2"');
        });

        it('dispatchTask should update existing task', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            // Update status
            const updatedTask: TaskDispatch = { id: 'T1', agent: 'A1', description: 'Desc', status: 'complete' };
            await bus.dispatchTask(updatedTask);

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('"status": "complete"');
        });

        it('updateTaskStatus should update status and timestamps', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            await bus.updateTaskStatus('T1', 'complete');

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('"status": "complete"');
            expect(writeArgs).toContain('completedAt');
        });

        it('updateTaskStatus should do nothing if task not found', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            await bus.updateTaskStatus('MISSING', 'complete');

            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it('getTasksForAgent should filter tasks', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            const tasks = await bus.getTasksForAgent('A1');
            expect(tasks).toHaveLength(1);
            expect(tasks[0].id).toBe('T1');
        });

        it('getTasksForAgent should return empty if no state', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
            const tasks = await bus.getTasksForAgent('A1');
            expect(tasks).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Heartbeats
    // -------------------------------------------------------------------------
    describe('Heartbeat Operations', () => {
        const existingState: OrchestratorState = {
            currentPhase: {
                phase: 'test', phaseDoc: 'doc', status: 'in_progress', startedAt: 'now',
                tasks: [], lastUpdated: 'now'
            },
            heartbeats: [{ agentId: 'A1', conversationId: 'c1', role: 'r1', status: 'idle', lastSeen: 'old' }],
            lastOrchestratorPoll: 'now'
        };
        const block = `<MEMORY[ORCHESTRATOR_DISPATCH]>${JSON.stringify(existingState)}</MEMORY[ORCHESTRATOR_DISPATCH]>`;

        it('updateHeartbeat should add new heartbeat', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            const hb: AgentHeartbeat = { agentId: 'A2', conversationId: 'c2', role: 'r2', status: 'working', lastSeen: 'new' };
            await bus.updateHeartbeat(hb);

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('A2');
        });

        it('updateHeartbeat should update existing heartbeat', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            const hb: AgentHeartbeat = { agentId: 'A1', conversationId: 'c1', role: 'r1', status: 'working', lastSeen: 'new' };
            await bus.updateHeartbeat(hb);

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('"status": "working"');
            expect(writeArgs).not.toContain('"status": "idle"');
        });

        it('updateHeartbeat should create default state if missing', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false);

            const hb: AgentHeartbeat = { agentId: 'A1', conversationId: 'c1', role: 'r1', status: 'working', lastSeen: 'new' };
            await bus.updateHeartbeat(hb);

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('phase-2-context-injection');
            expect(writeArgs).toContain('A1');
        });

        it('getAgentHeartbeats should return list', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block);

            const hearts = await bus.getAgentHeartbeats();
            expect(hearts).toHaveLength(1);
            expect(hearts[0].agentId).toBe('A1');
        });
    });

    // -------------------------------------------------------------------------
    // Phase Operations
    // -------------------------------------------------------------------------
    describe('Phase Operations', () => {
        const existingState: OrchestratorState = {
            currentPhase: {
                phase: 'test', phaseDoc: 'doc', status: 'in_progress', startedAt: 'now',
                tasks: [{ id: 'T1', agent: 'A1', description: 'Desc', status: 'pending' }],
                lastUpdated: 'now'
            },
            heartbeats: [], lastOrchestratorPoll: 'now'
        };
        const block = `<MEMORY[ORCHESTRATOR_DISPATCH]>${JSON.stringify(existingState)}</MEMORY[ORCHESTRATOR_DISPATCH]>`;

        it('initializePhase should overwrite state', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false);

            await bus.initializePhase('P3', 'doc', []);

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('"phase": "P3"');
            expect(writeArgs).toContain('in_progress');
        });

        it('isPhaseComplete should return false if tasks pending', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(block); // task T1 is pending

            const complete = await bus.isPhaseComplete();
            expect(complete).toBe(false);
        });

        it('isPhaseComplete should return true if all tasks complete', async () => {
            const doneState = JSON.parse(JSON.stringify(existingState));
            doneState.currentPhase.tasks[0].status = 'complete';
            const doneBlock = `<MEMORY[ORCHESTRATOR_DISPATCH]>${JSON.stringify(doneState)}</MEMORY[ORCHESTRATOR_DISPATCH]>`;

            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(doneBlock);

            const complete = await bus.isPhaseComplete();
            expect(complete).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // CLI
    // -------------------------------------------------------------------------
    describe('initializePhase2 (CLI)', () => {
        it('should initialize phase 2 tasks', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false); // New file

            await initializePhase2();

            const writeArgs = (fs.writeFile as unknown as jest.Mock).mock.calls[0][1];
            expect(writeArgs).toContain('P2-001');
            expect(writeArgs).toContain('P2-005');
        });
    });

});
