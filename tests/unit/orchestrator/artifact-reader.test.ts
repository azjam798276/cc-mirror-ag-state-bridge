
import { ArtifactReader } from '../../../src/orchestrator/artifact-reader';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('fs-extra');

describe('ArtifactReader', () => {
    let reader: ArtifactReader;

    beforeEach(() => {
        jest.clearAllMocks();
        reader = new ArtifactReader('/base');
    });

    describe('parseTaskMd', () => {
        it('should parse task.md content correctly', () => {
            const content = `# Title\n- [ ] Task 1\n- [x] Task 2\n- [/] Task 3`;
            const parsed = reader.parseTaskMd(content, '123', 'role');

            expect(parsed.title).toBe('Title');
            expect(parsed.totalCount).toBe(3);
            expect(parsed.completedCount).toBe(1);
            expect(parsed.items[2].status).toBe('in_progress');
        });

        it('should handle malformed tasks', () => {
            const content = `Not a task\n- [ ] valid`;
            const parsed = reader.parseTaskMd(content, '123', 'role');
            expect(parsed.totalCount).toBe(1);
        });
    });

    describe('parseWalkthrough', () => {
        it('should parse walkthrough.md content', () => {
            const content = `# Walkthrough\n## Section 1\ntcontent\n![img](test.png)\n✅ Test 1`;
            const parsed = reader.parseWalkthrough(content, '123', 'role', '/brain');

            expect(parsed.title).toBe('Walkthrough');
            expect(parsed.sections).toHaveLength(2);
            expect(parsed.screenshots).toContain('test.png');
            expect(parsed.testResults[0].status).toBe('pass');
        });
    });

    describe('readAgentArtifacts', () => {
        it('should read all artifacts if present', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(true);
            ((fs.readFile as unknown) as jest.Mock).mockResolvedValue('# artifact content');
            (fs.readdir as unknown as jest.Mock).mockResolvedValue(['other.txt']);

            const artifacts = await reader.readAgentArtifacts('123', 'role');

            expect(artifacts.task).toBeDefined();
            expect(artifacts.walkthrough).toBeDefined();
            expect(artifacts.implementationPlan).toBeDefined();
            expect(artifacts.otherFiles).toContain('other.txt');
        });

        it('should handle missing brain dir', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(false);
            const artifacts = await reader.readAgentArtifacts('123', 'role');
            expect(artifacts.task).toBeUndefined();
        });
    });

    describe('getArtifactMetadata', () => {
        it('should return metadata', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(true);
            (fs.stat as unknown as jest.Mock).mockResolvedValue({ mtime: new Date(), size: 100 });

            const meta = await reader.getArtifactMetadata('123', 'task.md');
            expect(meta.exists).toBe(true);
            expect(meta.artifactType).toBe('task');
            expect(meta.sizeBytes).toBe(100);
        });
    });

    describe('aggregatePhaseReport', () => {
        it('should aggregate valid reports', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(true);
            ((fs.readFile as unknown) as jest.Mock).mockResolvedValue('# content');
            (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);

            const report = await reader.aggregatePhaseReport('phase 1', [{ conversationId: '1', role: 'test' }]);
            expect(report.phase).toBe('phase 1');
            expect(report.agents).toHaveLength(1);
        });
    });
    describe('listBrainDirectories', () => {
        it('should return valid UUID-like directories', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(true);
            (fs.readdir as unknown as jest.Mock).mockResolvedValue([
                'e20afd38-f5dc-4f4c-aadc-a720cc401eaf', // Valid
                'invalid-folder',
                '1234'
            ]);

            const dirs = await reader.listBrainDirectories();
            expect(dirs).toHaveLength(1);
            expect(dirs[0]).toBe('e20afd38-f5dc-4f4c-aadc-a720cc401eaf');
        });

        it('should return empty if brain dir missing', async () => {
            (fs.pathExists as jest.Mock).mockResolvedValue(false);
            const dirs = await reader.listBrainDirectories();
            expect(dirs).toEqual([]);
        });
    });

    describe('CLI Runner', () => {
        let consoleSpy: jest.SpyInstance;
        let aggregateSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            aggregateSpy = jest.spyOn(ArtifactReader.prototype, 'aggregatePhaseReport').mockResolvedValue({
                phase: 'test-phase',
                generatedAt: new Date(),
                agents: [],
                summary: {
                    totalAgents: 1, completedAgents: 1, totalTasks: 1, completedTasks: 1, percentComplete: 100
                },
                combinedWalkthrough: '# Test Walkthrough'
            });
            (fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
        });

        afterEach(() => {
            consoleSpy.mockRestore();
            aggregateSpy.mockRestore();
        });

        it('should execute main flow correctly', async () => {
            // We need to require the module to test the exported main. 
            // Since we're in the same test file, we can't easily re-require to trigger require.main === module.
            // But we exported 'main', so we can call it directly.
            const { main } = require('../../../src/orchestrator/artifact-reader');
            await main();

            expect(aggregateSpy).toHaveBeenCalledWith(
                'phase-2-context-injection',
                expect.any(Array)
            );
            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('combined-walkthrough.md'),
                '# Test Walkthrough'
            );
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PHASE REPORT'));
        });
    });
});
