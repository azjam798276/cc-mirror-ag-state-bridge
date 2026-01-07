/**
 * Artifact Progress Scanner
 * 
 * Automatically detects task completion by scanning for expected artifacts.
 * Updates agent task.md files based on detected files.
 */

import * as fs from 'fs-extra';
import * as path from 'path';

export interface TaskArtifact {
    taskId: string;
    files: string[];  // Expected files to exist
    testFiles?: string[];  // Expected test files
}

export interface SprintConfig {
    sprint: number;
    tasks: TaskArtifact[];
}

// Sprint artifact expectations
const SPRINT_CONFIGS: SprintConfig[] = [
    {
        sprint: 4,
        tasks: [
            {
                taskId: 'S4-001',
                files: ['src/providers/antigravity/enhancement/thinking-sanitizer.ts'],
                testFiles: ['tests/unit/enhancement/thinking-sanitizer.test.ts']
            },
            {
                taskId: 'S4-002',
                files: ['src/providers/antigravity/enhancement/tool-hardener.ts'],
                testFiles: ['tests/unit/enhancement/tool-hardener.test.ts']
            },
            {
                taskId: 'S4-003',
                files: ['src/providers/antigravity/account/account-pool.ts'],
                testFiles: ['tests/unit/account/account-pool.test.ts']
            },
            {
                taskId: 'S4-004',
                files: [
                    'src/providers/antigravity/account/tier-manager.ts',
                    'src/providers/antigravity/account/quota-tracker.ts'
                ],
                testFiles: [
                    'tests/unit/account/tier-manager.test.ts',
                    'tests/unit/account/quota-tracker.test.ts'
                ]
            },
            {
                taskId: 'S4-005',
                files: ['tests/integration/full-flow.test.ts']
            }
        ]
    },
    {
        sprint: 5,
        tasks: [
            {
                taskId: 'S5-001',
                files: ['docs/antigravity/setup-guide.md', 'docs/antigravity/troubleshooting.md']
            },
            {
                taskId: 'S5-002',
                files: ['tests/performance/benchmarks.test.ts']
            },
            {
                taskId: 'S5-003',
                files: ['coverage-report.json']
            }
        ]
    }
];

export class ArtifactProgressScanner {
    constructor(private repoRoot: string) { }

    /**
     * Scan repository for expected artifacts and return completion status
     */
    async scanSprint(sprintNum: number): Promise<Map<string, boolean>> {
        const config = SPRINT_CONFIGS.find(c => c.sprint === sprintNum);
        if (!config) {
            throw new Error(`Sprint ${sprintNum} not configured`);
        }

        const completionMap = new Map<string, boolean>();

        for (const task of config.tasks) {
            const isComplete = await this.isTaskComplete(task);
            completionMap.set(task.taskId, isComplete);
        }

        return completionMap;
    }

    /**
     * Check if a task is complete based on expected artifacts
     */
    private async isTaskComplete(task: TaskArtifact): Promise<boolean> {
        // Check all required files exist
        for (const file of task.files) {
            const filePath = path.join(this.repoRoot, file);
            if (!(await fs.pathExists(filePath))) {
                return false;
            }
        }

        // If test files are expected, at least one must exist
        if (task.testFiles && task.testFiles.length > 0) {
            let hasAnyTest = false;
            for (const testFile of task.testFiles) {
                const testPath = path.join(this.repoRoot, testFile);
                if (await fs.pathExists(testPath)) {
                    hasAnyTest = true;
                    break;
                }
            }
            if (!hasAnyTest) {
                return false;
            }
        }

        return true;
    }

    /**
     * Auto-update agent task.md file based on detected artifacts
     */
    async updateAgentTask(brainDir: string, sprintNum: number): Promise<void> {
        const taskMdPath = path.join(brainDir, 'task.md');
        if (!(await fs.pathExists(taskMdPath))) {
            return;
        }

        const content = await fs.readFile(taskMdPath, 'utf-8');
        const completionMap = await this.scanSprint(sprintNum);

        let updated = content;
        for (const [taskId, isComplete] of completionMap.entries()) {
            if (isComplete) {
                // Replace - [ ] with - [x] for this task (handles both formats: "S4-001:" and "S4-001 ")
                const regex = new RegExp(`- \\[ \\] (${taskId}[:\\s])`, 'g');
                updated = updated.replace(regex, '- [x] $1');
            }
        }

        if (updated !== content) {
            await fs.writeFile(taskMdPath, updated, 'utf-8');
            console.log(`[ArtifactScanner] Updated ${path.basename(brainDir)} with detected progress`);
        }
    }
}
