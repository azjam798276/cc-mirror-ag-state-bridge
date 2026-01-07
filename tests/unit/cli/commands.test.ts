
import { Command } from 'commander';
import { registerListAgSessionsCommand } from '../../../src/cli/list-ag-sessions';
import { registerShowAgSessionCommand } from '../../../src/cli/show-ag-session';
import { SessionDiscovery } from '../../../src/providers/antigravity/state-bridge/session-discovery';
import { SessionParser } from '../../../src/providers/antigravity/state-bridge/session-parser';

// Mock dependencies
jest.mock('../../../src/providers/antigravity/state-bridge/session-discovery');
jest.mock('../../../src/providers/antigravity/state-bridge/session-parser');

describe('CLI Commands', () => {
    let program: Command;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent process.exit from killing test

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        // Mock process.exit but allowing the override to catch it if possible, 
        // OR simply rely on exitOverride which throws generic error.
        // However, some commands might call process.exit directly without standard Commander handling.
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`Process exit ${code}`);
        });

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('list-ag-sessions', () => {
        beforeEach(() => {
            registerListAgSessionsCommand(program);
        });

        it('should show message when no sessions found', async () => {
            (SessionDiscovery.prototype.findSessions as jest.Mock).mockResolvedValue([]);

            await program.parseAsync(['node', 'test', 'list-ag-sessions']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No Antigravity sessions found'));
        });

        it('should list sessions when found', async () => {
            const mockSessions = [
                { sessionId: 's1', ageString: '1h', filePath: '/path/s1', timestamp: new Date() },
                { sessionId: 's2', ageString: '2h', filePath: '/path/s2', timestamp: new Date() }
            ];
            (SessionDiscovery.prototype.findSessions as jest.Mock).mockResolvedValue(mockSessions);

            const mockParsed = {
                goal: 'Test Goal',
                completedSteps: [1],
                planSteps: [1, 2],
                filesModified: ['f1']
            };
            (SessionParser.prototype.parse as jest.Mock).mockResolvedValue(mockParsed);

            await program.parseAsync(['node', 'test', 'list-ag-sessions']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('s1'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('s2'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test Goal'));
        });

        it('should support json output', async () => {
            const mockSessions = [{ sessionId: 's1' }];
            (SessionDiscovery.prototype.findSessions as jest.Mock).mockResolvedValue(mockSessions);

            await program.parseAsync(['node', 'test', 'list-ag-sessions', '--json']);

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockSessions, null, 2));
        });
    });

    describe('show-ag-session', () => {
        beforeEach(() => {
            registerShowAgSessionCommand(program);
        });

        it('should error if session not found', async () => {
            (SessionDiscovery.prototype.getSessionById as jest.Mock).mockResolvedValue(null);
            (SessionDiscovery.prototype.findSessions as jest.Mock).mockResolvedValue([]);

            await expect(program.parseAsync(['node', 'test', 'show-ag-session', 'missing']))
                .rejects.toThrow('Process exit 1');

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Session not found'));
        });

        it('should show session details', async () => {
            const mockSession = {
                sessionId: 's1',
                filePath: '/path/s1',
                timestamp: new Date()
            };
            (SessionDiscovery.prototype.getSessionById as jest.Mock).mockResolvedValue(mockSession);

            const mockParsed = {
                sessionId: 's1',
                goal: 'My Goal',
                planSteps: [{ action: 'step 1', status: 'completed' }],
                completedSteps: [1],
                filesModified: ['mod.ts'],
                variables: { var1: 'val1' }
            };
            (SessionParser.prototype.parse as jest.Mock).mockResolvedValue(mockParsed);

            await program.parseAsync(['node', 'test', 'show-ag-session', 's1']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('My Goal'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('step 1'));
        });

        it('should support json output', async () => {
            const mockSession = {
                sessionId: 's1',
                filePath: '/path/s1',
                timestamp: new Date('2023-01-01T00:00:00.000Z')
            };
            (SessionDiscovery.prototype.getSessionById as jest.Mock).mockResolvedValue(mockSession);
            (SessionParser.prototype.parse as jest.Mock).mockResolvedValue({ sessionId: 's1' });

            await program.parseAsync(['node', 'test', 'show-ag-session', 's1', '--json']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"sessionId": "s1"'));
        });
    });
});
