
import { GitProgressTracker } from '../../../src/orchestrator/git-tracker';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('child_process');
jest.mock('fs-extra');

describe('GitProgressTracker', () => {
    let tracker: GitProgressTracker;
    const repoRoot = '/test/repo';

    beforeEach(() => {
        jest.clearAllMocks();
        tracker = new GitProgressTracker(repoRoot);
    });

    describe('getCommitsSince', () => {
        it('should return parsed commits', () => {
            const mockOutput = 'hash1|feat(test): S4-001 test|2023-01-01T00:00:00.000Z|author1\n' +
                'hash2|fix: bug|2023-01-02T00:00:00.000Z|author2';
            (execSync as jest.Mock).mockReturnValue(mockOutput);

            const commits = tracker.getCommitsSince(new Date('2022-01-01'));
            expect(commits).toHaveLength(2);
            expect(commits[0].hash).toBe('hash1');
            expect(commits[0].message).toBe('feat(test): S4-001 test');
        });

        it('should return empty array if no output', () => {
            (execSync as jest.Mock).mockReturnValue('   ');
            const commits = tracker.getCommitsSince(new Date());
            expect(commits).toHaveLength(0);
        });

        it('should handle errors gracefully', () => {
            (execSync as jest.Mock).mockImplementation(() => { throw new Error('git error'); });
            const commits = tracker.getCommitsSince(new Date());
            expect(commits).toEqual([]);
        });
    });

    describe('extractCompletedTasks', () => {
        it('should extract task IDs matching pattern', () => {
            const commits = [
                { hash: '1', message: 'S4-001: done', timestamp: new Date(), author: 'me' },
                { hash: '2', message: 'S4-002, S4-003 complete', timestamp: new Date(), author: 'me' }
            ];
            const completed = tracker.extractCompletedTasks(commits, /S4-\d+/g);
            expect(completed.has('S4-001')).toBe(true);
            expect(completed.has('S4-002')).toBe(true);
            expect(completed.has('S4-003')).toBe(true);
        });
    });

    describe('getSprintProgress', () => {
        it('should read start time from GEMINI.md and invoke getCommitsSince', async () => {
            ((fs.readFile as unknown) as jest.Mock).mockResolvedValue('... "startedAt": "2023-01-01T10:00:00.000Z" ...');
            (execSync as jest.Mock).mockReturnValue('h|S5-001 done|2023-01-01T11:00:00.000Z|me');

            const progress = await tracker.getSprintProgress(5);
            expect(progress.get('S5-001')).toBe(true);
            expect(progress.get('S5-002')).toBe(false);
        });

        it('should fallback to 24h ago if startedAt not found', async () => {
            ((fs.readFile as unknown) as jest.Mock).mockResolvedValue('no timestamp here');
            (execSync as jest.Mock).mockReturnValue('');
            await tracker.getSprintProgress(5);
            expect(execSync).toHaveBeenCalled();
        });
    });

    describe('updateAgentTaskFromGit', () => {
        it('should update task.md with completed items', async () => {
            const brainDir = '/brain';
            const taskPath = path.join(brainDir, 'task.md');

            (fs.pathExists as jest.Mock).mockResolvedValue(true);
            ((fs.readFile as unknown) as jest.Mock).mockResolvedValue('- [ ] S5-001: Task 1');

            // Spy on getSprintProgress to return preset map
            const progressMap = new Map<string, boolean>();
            progressMap.set('S5-001', true);
            jest.spyOn(tracker, 'getSprintProgress').mockResolvedValue(progressMap);

            await tracker.updateAgentTaskFromGit(brainDir, 5);

            expect(fs.writeFile).toHaveBeenCalledWith(taskPath, expect.stringContaining('- [x] S5-001'), 'utf-8');
        });

        it('should do nothing if task.md does not exist', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(false);
            await tracker.updateAgentTaskFromGit('/brain', 1);
            expect(fs.readFile).not.toHaveBeenCalled();
        });
    });

    describe('getSprintSummary', () => {
        it('should return filtered summary', async () => {
            const progressMap = new Map<string, boolean>();
            progressMap.set('S5-001', true);
            jest.spyOn(tracker, 'getSprintProgress').mockResolvedValue(progressMap);

            const summary = await tracker.getSprintSummary(5);
            expect(summary.completed).toBe(1);
            expect(summary.tasks.has('S5-001')).toBe(true);
        });
    });
});
