import { SessionDiscovery } from '../../../src/providers/antigravity/state-bridge/session-discovery';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionDiscovery Security', () => {
    let discovery: SessionDiscovery;
    const home = os.homedir();
    const primaryPath = path.join(home, '.antigravity', 'sessions');

    beforeEach(() => {
        discovery = new SessionDiscovery();
        jest.clearAllMocks();
        mockFs.existsSync.mockImplementation((p) => p === primaryPath);
    });

    it('should reject sessions with path traversal in filenames', async () => {
        // Mock readdir returning a suspicious filename that might try to escape if not handled
        mockFs.readdirSync.mockReturnValue([
            { name: '../../etc/passwd', isDirectory: () => false, isFile: () => true }
        ] as any);

        const sessions = await discovery.findSessions();

        // It should either skip it or at least ensure the resulting path is validated
        // In our implementation, path.join(basePath, file) will be called.
        // SessionDiscovery.findSessions should skip it because it's not .json anyway, 
        // but let's test a .json one that tries to escape.
        mockFs.readdirSync.mockReturnValue([
            { name: '../escaped.json', isDirectory: () => false, isFile: () => true }
        ] as any);
        mockFs.statSync.mockReturnValue({ mtime: new Date(), size: 100 } as any);

        const sessions2 = await discovery.findSessions();
        expect(sessions2).toEqual([]);
    });

    it('should only accept sessions within authorized base paths', async () => {
        // This is primarily handled by the searchPaths loop, but we added a check
        // for each file path.
        mockFs.readdirSync.mockReturnValue([
            { name: 'session-valid.json', isDirectory: () => false, isFile: () => true }
        ] as any);
        mockFs.statSync.mockReturnValue({ mtime: new Date(), size: 100 } as any);

        const sessions = await discovery.findSessions();
        expect(sessions.length).toBe(1);
        expect(sessions[0].sessionId).toBe('valid');
    });
});
