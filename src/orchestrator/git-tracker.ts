/**
 * Git-Based Progress Tracker
 * 
 * Tracks task completion based on git commits instead of file existence.
 * More reliable than artifact scanning.
 */

import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface GitCommit {
    hash: string;
    message: string;
    timestamp: Date;
    author: string;
}

export interface SprintCommitTracker {
    sprint: number;
    startTime: Date;
    taskPattern: RegExp;  // e.g., /S4-\d+/
}

export class GitProgressTracker {
    private repoRoot: string;

    constructor(repoRoot: string) {
        this.repoRoot = repoRoot;
    }

    /**
     * Get commits since a specific timestamp
     */
    getCommitsSince(since: Date): GitCommit[] {
        try {
            const sinceStr = since.toISOString();
            const logOutput = execSync(
                `git log --since="${sinceStr}" --pretty=format:"%H|%s|%ai|%an"`,
                { cwd: this.repoRoot, encoding: 'utf-8' }
            );

            if (!logOutput.trim()) {
                return [];
            }

            return logOutput.split('\n').map(line => {
                const [hash, message, timestamp, author] = line.split('|');
                return {
                    hash,
                    message,
                    timestamp: new Date(timestamp),
                    author
                };
            });
        } catch (error) {
            console.error('[GitTracker] Error getting commits:', error);
            return [];
        }
    }

    /**
     * Extract task IDs from commits (e.g., "S4-001", "S4-002")
     */
    extractCompletedTasks(commits: GitCommit[], taskPattern: RegExp): Set<string> {
        const completed = new Set<string>();

        for (const commit of commits) {
            const matches = commit.message.match(taskPattern);
            if (matches) {
                for (const match of matches) {
                    completed.add(match);
                }
            }
        }

        return completed;
    }

    /**
     * Get task completion status for current sprint
     */
    async getSprintProgress(sprintNum: number): Promise<Map<string, boolean>> {
        // Read sprint start time from GEMINI.md
        const geminiPath = path.join(process.env.HOME || '', '.gemini', 'GEMINI.md');
        const geminiContent = await fs.readFile(geminiPath, 'utf-8');

        // Extract startedAt timestamp
        const match = geminiContent.match(/"startedAt":\s*"([^"]+)"/);
        const startTime = match ? new Date(match[1]) : new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Get commits since sprint start
        const commits = this.getCommitsSince(startTime);

        // Extract task IDs (e.g., S4-001, S4-002)
        const taskPattern = new RegExp(`S${sprintNum}-(\\d+)`, 'g');
        const completedTasks = this.extractCompletedTasks(commits, taskPattern);

        // Build completion map
        const completionMap = new Map<string, boolean>();

        // Assume up to 10 tasks per sprint
        for (let i = 1; i <= 10; i++) {
            const taskId = `S${sprintNum}-${String(i).padStart(3, '0')}`;
            completionMap.set(taskId, completedTasks.has(taskId));
        }

        return completionMap;
    }

    /**
     * Auto-update agent task.md based on git commits
     */
    async updateAgentTaskFromGit(brainDir: string, sprintNum: number): Promise<void> {
        const taskMdPath = path.join(brainDir, 'task.md');
        if (!(await fs.pathExists(taskMdPath))) {
            return;
        }

        const content = await fs.readFile(taskMdPath, 'utf-8');
        const completionMap = await this.getSprintProgress(sprintNum);

        let updated = content;
        for (const [taskId, isComplete] of completionMap.entries()) {
            if (isComplete) {
                // Replace - [ ] with - [x] for completed tasks
                const regex = new RegExp(`- \\[ \\] (${taskId}[:\\s])`, 'g');
                updated = updated.replace(regex, '- [x] $1');
            }
        }

        if (updated !== content) {
            await fs.writeFile(taskMdPath, updated, 'utf-8');
            console.log(`[GitTracker] Updated ${path.basename(brainDir)} based on commits`);
        }
    }

    /**
     * Get summary of sprint progress
     */
    async getSprintSummary(sprintNum: number): Promise<{ total: number; completed: number; tasks: Map<string, boolean> }> {
        const tasks = await this.getSprintProgress(sprintNum);

        // Filter to only tasks that exist (have true or false, not just all false)
        const relevantTasks = new Map<string, boolean>();
        for (const [taskId, status] of tasks.entries()) {
            // Only include if task appears in commits OR in task files
            if (status) {
                relevantTasks.set(taskId, status);
            }
        }

        const completed = Array.from(relevantTasks.values()).filter(v => v).length;
        const total = relevantTasks.size;

        return { total, completed, tasks: relevantTasks };
    }
}
