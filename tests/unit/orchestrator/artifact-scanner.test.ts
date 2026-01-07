
import { ArtifactProgressScanner } from '../../../src/orchestrator/artifact-scanner';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('fs-extra');

describe('ArtifactProgressScanner', () => {
    let scanner: ArtifactProgressScanner;
    const mockRepoRoot = '/mock/repo';
    const mockTaskMdPath = '/mock/brain/task.md';

    beforeEach(() => {
        jest.clearAllMocks();
        scanner = new ArtifactProgressScanner(mockRepoRoot);
    });

    describe('scanSprint', () => {
        it('should throw error for invalid sprint', async () => {
            await expect(scanner.scanSprint(999)).rejects.toThrow('Sprint 999 not configured');
        });

        it('should return completion map for valid sprint', async () => {
            // Mock file existence for S4-001 (complete)
            (fs.pathExists as unknown as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('thinking-sanitizer.ts')) return Promise.resolve(true); // Source
                if (filePath.includes('thinking-sanitizer.test.ts')) return Promise.resolve(true); // Test
                return Promise.resolve(false);
            });

            const completionMap = await scanner.scanSprint(4);

            expect(completionMap.has('S4-001')).toBe(true);
            expect(completionMap.get('S4-001')).toBe(true);

            expect(completionMap.has('S4-002')).toBe(true);
            expect(completionMap.get('S4-002')).toBe(false); // Files mocked to false by default
        });

        it('should mark task incomplete if required file missing', async () => {
            // S4-001: Source missing
            (fs.pathExists as unknown as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('thinking-sanitizer.ts')) return Promise.resolve(false);
                if (filePath.includes('thinking-sanitizer.test.ts')) return Promise.resolve(true);
                return Promise.resolve(false);
            });
            const completionMap = await scanner.scanSprint(4);
            expect(completionMap.get('S4-001')).toBe(false);
        });

        it('should mark task incomplete if test file expected but missing', async () => {
            // S4-001: Source present, Test missing
            (fs.pathExists as unknown as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('thinking-sanitizer.ts')) return Promise.resolve(true);
                return Promise.resolve(false);
            });
            const completionMap = await scanner.scanSprint(4);
            expect(completionMap.get('S4-001')).toBe(false);
        });

        it('should mark task complete if at least one test file exists', async () => {
            // S4-004 has multiple test files. Mock just one existing.
            (fs.pathExists as unknown as jest.Mock).mockImplementation((filePath: string) => {
                // Source files
                if (filePath.includes('tier-manager.ts')) return Promise.resolve(true);
                if (filePath.includes('quota-tracker.ts')) return Promise.resolve(true);
                // One test file exists
                if (filePath.includes('tier-manager.test.ts')) return Promise.resolve(true);
                return Promise.resolve(false);
            });
            const completionMap = await scanner.scanSprint(4);
            expect(completionMap.get('S4-004')).toBe(true);
        });
    });

    describe('updateAgentTask', () => {
        it('should do nothing if task.md does not exist', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(false);
            await scanner.updateAgentTask('/mock/brain', 4);
            expect(fs.readFile).not.toHaveBeenCalled();
            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it('should update task list with completed items', async () => {
            (fs.pathExists as jest.Mock).mockImplementation((p) => {
                if (p === mockTaskMdPath) return Promise.resolve(true);
                // S4-001 complete
                if (typeof p === 'string' && p.includes('thinking-sanitizer')) return Promise.resolve(true);
                return Promise.resolve(false);
            });

            (fs.readFile as unknown as jest.Mock).mockResolvedValue(`
- [ ] S4-001: Implement Sanitizer
- [ ] S4-002: Tool Hardener
            `);

            await scanner.updateAgentTask('/mock/brain', 4);

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockTaskMdPath,
                expect.stringContaining('- [x] S4-001: Implement Sanitizer'),
                'utf-8'
            );
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockTaskMdPath,
                expect.stringContaining('- [ ] S4-002: Tool Hardener'),
                'utf-8'
            );
        });

        it('should not write if content unchanged', async () => {
            (fs.pathExists as jest.Mock).mockImplementation((p) => {
                if (p === mockTaskMdPath) return Promise.resolve(true);
                // No tasks complete
                return Promise.resolve(false);
            });

            (fs.readFile as unknown as jest.Mock).mockResolvedValue(`- [ ] S4-001: Implement Sanitizer`);

            await scanner.updateAgentTask('/mock/brain', 4);

            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it('should match tasks named with colon suffix in task.md', async () => {
            (fs.pathExists as jest.Mock).mockImplementation((p) => {
                if (p === mockTaskMdPath) return Promise.resolve(true);
                if (typeof p === 'string' && p.includes('thinking-sanitizer')) return Promise.resolve(true);
                return Promise.resolve(false);
            });

            // IDs like "S4-001:"
            (fs.readFile as unknown as jest.Mock).mockResolvedValue(`- [ ] S4-001: Description`);

            await scanner.updateAgentTask('/mock/brain', 4);

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockTaskMdPath,
                expect.stringContaining('- [x] S4-001: Description'),
                'utf-8'
            );
        });
    });
});
