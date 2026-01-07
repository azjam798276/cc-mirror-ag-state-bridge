/**
 * SessionDiscovery Unit Tests
 * 
 * Tests the ability to find and list AG sessions on the filesystem.
 * Based on TDD v1.0 Module 1 specification.
 */

import { SessionDiscovery, AGSessionMetadata } from '../../../src/providers/antigravity/state-bridge/session-discovery';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Mock fs-extra
jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionDiscovery', () => {
    let discovery: SessionDiscovery;
    const fixturesPath = path.join(__dirname, '../fixtures/ag-sessions');

    beforeEach(() => {
        discovery = new SessionDiscovery();
        jest.clearAllMocks();

        // Default: Only the primary home path exists to avoid multiple path search noise in tests
        const home = os.homedir();
        const primaryPath = path.join(home, '.antigravity', 'sessions');
        mockFs.existsSync.mockImplementation((p) => p === primaryPath);
    });

    describe('findSessions', () => {
        it('should return empty array when no sessions exist', async () => {
            mockFs.existsSync.mockImplementation(() => false);

            const sessions = await discovery.findSessions();

            expect(sessions).toEqual([]);
        });

        it('should find sessions in default path', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-abc123.json', isDirectory: () => false, isFile: () => true },
                { name: 'session-def456.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({
                mtime: new Date('2026-01-07T08:00:00Z'),
                size: 1024
            } as any));

            const sessions = await discovery.findSessions();

            expect(sessions.length).toBe(2);
            expect(sessions[0].sessionId).toBe('abc123');
        });

        it('should sort sessions by mtime descending', async () => {
            const oldDate = new Date('2026-01-06');
            const newDate = new Date('2026-01-07');

            mockFs.readdirSync.mockReturnValue([
                { name: 'session-old.json', isDirectory: () => false, isFile: () => true },
                { name: 'session-new.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation((p: any) => ({
                mtime: p.includes('new') ? newDate : oldDate,
                size: 100
            } as any));

            const sessions = await discovery.findSessions();

            expect(sessions[0].sessionId).toBe('new');
            expect(sessions[1].sessionId).toBe('old');
        });

        it('should respect AG_SESSION_DIR environment variable', async () => {
            const customPath = '/custom/path';
            process.env.AG_SESSION_DIR = customPath;

            mockFs.existsSync.mockImplementation((p) => p === customPath);
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-custom.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({ mtime: new Date(), size: 100 } as any));

            const sessions = await discovery.findSessions();

            expect(mockFs.existsSync).toHaveBeenCalledWith(customPath);
            delete process.env.AG_SESSION_DIR;
        });

        it('should skip unreadable files without error', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-good.json', isDirectory: () => false, isFile: () => true },
                { name: 'session-bad.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation((p: any) => {
                if (p.includes('bad')) throw new Error('Permission denied');
                return { mtime: new Date(), size: 100 } as any;
            });

            const sessions = await discovery.findSessions();

            expect(sessions.length).toBe(1);
            expect(sessions[0].sessionId).toBe('good');
        });
    });

    describe('getLatestSession', () => {
        it('should return null when no sessions exist', async () => {
            mockFs.existsSync.mockImplementation(() => false);

            const session = await discovery.getLatestSession();

            expect(session).toBeNull();
        });

        it('should return the most recent session', async () => {
            const oldDate = new Date('2026-01-06');
            const newestDate = new Date('2026-01-07');

            mockFs.readdirSync.mockReturnValue([
                { name: 'session-older.json', isDirectory: () => false, isFile: () => true },
                { name: 'session-newest.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation((p: any) => ({
                mtime: p.includes('newest') ? newestDate : oldDate,
                size: 100
            } as any));

            const session = await discovery.getLatestSession();

            expect(session?.sessionId).toBe('newest');
        });
    });

    describe('getSessionById', () => {
        it('should return session with matching ID', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-target.json', isDirectory: () => false, isFile: () => true },
                { name: 'session-other.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({ mtime: new Date(), size: 100 } as any));

            const session = await discovery.getSessionById('target');

            expect(session?.sessionId).toBe('target');
        });

        it('should return null for non-existent session ID', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-other.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({ mtime: new Date(), size: 100 } as any));

            const session = await discovery.getSessionById('nonexistent');

            expect(session).toBeNull();
        });
    });

    describe('caching', () => {
        it('should cache results for 60 seconds', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-cached.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({ mtime: new Date(), size: 100 } as any));

            await discovery.findSessions();
            await discovery.findSessions();

            // Total calls should be 1 * number of EXISTING paths (which is 1 our beforeEach)
            expect(mockFs.readdirSync).toHaveBeenCalledTimes(1);
        });

        it('should clear cache when clearCache is called', async () => {
            mockFs.readdirSync.mockReturnValue([
                { name: 'session-cached.json', isDirectory: () => false, isFile: () => true }
            ] as any);
            mockFs.statSync.mockImplementation(() => ({ mtime: new Date(), size: 100 } as any));

            await discovery.findSessions();
            discovery.clearCache();
            await discovery.findSessions();

            expect(mockFs.readdirSync).toHaveBeenCalledTimes(2);
        });
    });
});
