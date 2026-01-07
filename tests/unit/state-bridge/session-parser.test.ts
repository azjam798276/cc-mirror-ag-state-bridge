/**
 * SessionParser Unit Tests
 * 
 * Tests the ability to parse AG session JSON files.
 * Based on TDD v1.0 Module 2 specification.
 */

import { SessionParser, ParsedSession, SessionParseError } from '../../../src/providers/antigravity/state-bridge/session-parser';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock fs-extra
jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionParser', () => {
    let parser: SessionParser;
    const fixturesPath = path.join(__dirname, '../fixtures/ag-sessions');

    beforeEach(() => {
        parser = new SessionParser();
        jest.clearAllMocks();
    });

    describe('parse - Format v1', () => {
        const v1Session = {
            initialPrompt: 'Build REST API with auth',
            plan: [
                { id: 'step-1', description: 'Design schema', status: 'completed', files: ['schema.sql'] },
                { id: 'step-2', description: 'Implement model', status: 'executing', files: [] }
            ],
            currentStepIndex: 1,
            state: { variables: { DB_NAME: 'test' } }
        };

        it('should parse v1 format correctly', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(v1Session));

            const result = await parser.parse('/path/to/session.json');

            expect(result.goal).toBe('Build REST API with auth');
            expect(result.planSteps.length).toBe(2);
            expect(result.completedSteps.length).toBe(1);
            expect(result.pendingSteps.length).toBe(1);
            expect(result.variables.DB_NAME).toBe('test');
        });

        it('should extract completed and pending steps', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(v1Session));

            const result = await parser.parse('/path/to/session.json');

            expect(result.completedSteps[0].action).toBe('Design schema');
            expect(result.completedSteps[0].status).toBe('completed');
        });
    });

    describe('parse - Format v2', () => {
        const v2Session = {
            goal: 'Fix database timeout',
            steps: [
                { stepId: 's1', action: 'Analyze pool', phase: 'done', artifacts: ['config.yml'] },
                { stepId: 's2', action: 'Add retry', phase: 'pending', artifacts: [] }
            ],
            execution: { current: 's2', completed: ['s1'] },
            filesModified: ['config.yml', 'connection.ts'],
            variables: { POOL_SIZE: 10 }
        };

        it('should parse v2 format correctly', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(v2Session));

            const result = await parser.parse('/path/to/session.json');

            expect(result.goal).toBe('Fix database timeout');
            expect(result.planSteps.length).toBe(2);
            expect(result.filesModified).toContain('config.yml');
        });
    });

    describe('parse - Brain Directory', () => {
        const brainDir = '/home/user/.gemini/antigravity/brain/session-uuid';
        const taskMd = `
# Task: Optimize Database queries
- [x] Analyze slow queries
- [/] Add indexes
- [ ] Deploy changes
`;
        const planMd = `
# Plan
We will modify \`src/db/repo.ts\` and \`src/index.ts\`.
`;

        it('should parse brain directory structure', async () => {
            // Mock statSync to recognize directory
            mockFs.statSync.mockImplementation((p: any) => {
                if (p === brainDir) return { isDirectory: () => true } as any;
                return { isDirectory: () => false, size: 100 } as any;
            });

            // Mock existsSync for internal checks
            mockFs.existsSync.mockImplementation((p: any) => {
                return p.includes('task.md') || p.includes('implementation_plan.md');
            });

            // Mock readFileSync
            mockFs.readFileSync.mockImplementation((p: any) => {
                if (p.includes('task.md')) return taskMd;
                if (p.includes('implementation_plan.md')) return planMd;
                return '';
            });

            const result = await parser.parse(brainDir);

            expect(result.sessionId).toBe('session-uuid');
            expect(result.goal).toBe('Optimize Database queries');
            expect(result.planSteps.length).toBe(3);
            expect(result.completedSteps[0].action).toBe('Analyze slow queries');
            expect(result.filesModified).toContain('src/db/repo.ts');
        });

        it('should handle missing plan file', async () => {
            // Mock statSync to recognize directory
            mockFs.statSync.mockImplementation((p: any) => {
                if (p === brainDir) return { isDirectory: () => true } as any;
                return { isDirectory: () => false, size: 100 } as any;
            });

            mockFs.existsSync.mockImplementation((p: any) => p.includes('task.md')); // plan missing
            mockFs.readFileSync.mockImplementation((p: any) => {
                if (p.includes('task.md')) return taskMd;
                return '';
            });

            const result = await parser.parse(brainDir);
            expect(result.planSteps.length).toBe(3);
            expect(result.filesModified).toEqual([]);
        });
    });

    describe('parse - Generic fallback', () => {
        const unknownSession = {
            task: 'Refactor payment module',
            actions: [{ name: 'Review code', done: true }],
            modified: ['processor.ts']
        };

        it('should extract goal using heuristics', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(unknownSession));

            const result = await parser.parse('/path/to/session.json');

            expect(result.goal).toBe('Refactor payment module');
        });

        it('should extract files from modified field', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(unknownSession));

            const result = await parser.parse('/path/to/session.json');

            expect(result.filesModified).toContain('processor.ts');
        });
    });

    describe('error handling', () => {
        it('should throw SessionParseError for files > 50MB', async () => {
            mockFs.statSync.mockReturnValue({ size: 51 * 1024 * 1024, isDirectory: () => false } as any);

            await expect(parser.parse('/path/to/large.json')).rejects.toThrow(SessionParseError);
        });

        it('should throw SessionParseError for invalid JSON', async () => {
            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue('not valid json {{{');

            await expect(parser.parse('/path/to/invalid.json')).rejects.toThrow(SessionParseError);
        });

        it('should handle empty object gracefully', async () => {
            mockFs.statSync.mockReturnValue({ size: 2, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue('{}');

            const result = await parser.parse('/path/to/empty.json');

            expect(result.goal).toBe('Unknown goal');
            expect(result.planSteps).toEqual([]);
        });
    });

    describe('registerFormat', () => {
        it('should allow registering custom format detectors', async () => {
            const customDetector = {
                canParse: (obj: any) => !!obj.customField,
                parse: (obj: any) => ({
                    sessionId: 'custom',
                    goal: obj.customField,
                    planSteps: [],
                    currentStep: 0,
                    completedSteps: [],
                    pendingSteps: [],
                    filesModified: [],
                    variables: {}
                })
            };

            parser.registerFormat(customDetector);

            mockFs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false } as any);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({ customField: 'Custom goal' }));

            const result = await parser.parse('/path/to/custom.json');

            expect(result.goal).toBe('Custom goal');
        });
    });
});
