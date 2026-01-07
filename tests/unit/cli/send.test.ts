
import { Command } from 'commander';
import { registerSendCommand } from '../../../src/cli/send';
import { SessionDiscovery } from '../../../src/providers/antigravity/state-bridge/session-discovery';
import { SessionParser } from '../../../src/providers/antigravity/state-bridge/session-parser';
import { ContextInjector } from '../../../src/providers/antigravity/state-bridge/context-injector';

jest.mock('../../../src/providers/antigravity/state-bridge/session-discovery');
jest.mock('../../../src/providers/antigravity/state-bridge/session-parser');
jest.mock('../../../src/providers/antigravity/state-bridge/context-injector');

describe('CLI Send Command', () => {
    let program: Command;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        program.exitOverride();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`Process exit ${code}`);
        });
        registerSendCommand(program);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should send simple message without context', async () => {
        await program.parseAsync(['node', 'test', 'send', 'hello world']);

        // Should verify it prepared to send 'hello world'
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('hello world'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Ready to send'));
    });

    it('should inject context from latest session', async () => {
        const mockSession = { filePath: '/p/s1', sessionId: 's1' };
        const mockParsed = { sessionId: 's1', goal: 'G', completedSteps: [], planSteps: [] };

        (SessionDiscovery.prototype.getLatestSession as jest.Mock).mockResolvedValue(mockSession);
        (SessionParser.prototype.parse as jest.Mock).mockResolvedValue(mockParsed);
        (ContextInjector.prototype.injectContext as jest.Mock).mockReturnValue([
            { role: 'system', content: 'context' },
            { role: 'user', content: 'hello' }
        ]);

        await program.parseAsync(['node', 'test', 'send', '--continue-from-ag', 'hello']);

        expect(SessionDiscovery.prototype.getLatestSession).toHaveBeenCalled();
        expect(ContextInjector.prototype.injectContext).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded Antigravity context'));
    });

    it('should inject context from specific session', async () => {
        const mockSession = { filePath: '/p/s2', sessionId: 's2' };
        const mockParsed = { sessionId: 's2', goal: 'G', completedSteps: [], planSteps: [] };

        (SessionDiscovery.prototype.getSessionById as jest.Mock).mockResolvedValue(mockSession);
        (SessionParser.prototype.parse as jest.Mock).mockResolvedValue(mockParsed);
        (ContextInjector.prototype.injectContext as jest.Mock).mockReturnValue([]);

        await program.parseAsync(['node', 'test', 'send', '--ag-session', 's2', 'hello']);

        expect(SessionDiscovery.prototype.getSessionById).toHaveBeenCalledWith('s2');
    });

    it('should fail if specific session not found', async () => {
        (SessionDiscovery.prototype.getSessionById as jest.Mock).mockResolvedValue(null);

        await expect(program.parseAsync(['node', 'test', 'send', '--ag-session', 'missing', 'hello']))
            .rejects.toThrow('Process exit 1');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Session not found'));
    });

    it('should warn if no sessions found for --continue-from-ag', async () => {
        (SessionDiscovery.prototype.getLatestSession as jest.Mock).mockResolvedValue(null);

        await program.parseAsync(['node', 'test', 'send', '--continue-from-ag', 'hello']);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No Antigravity sessions found'));
        // Should proceed without context
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Ready to send'));
    });

    it('should support dry-run json output', async () => {
        await program.parseAsync(['node', 'test', 'send', 'hello', '--json', '--dry-run']);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"role": "user"'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
    });
});
