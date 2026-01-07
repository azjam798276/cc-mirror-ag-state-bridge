
import { WalkthroughAggregator } from '../../../src/orchestrator/walkthrough-aggregator';
import ArtifactReader from '../../../src/orchestrator/artifact-reader';
import GeminiMdMessageBus from '../../../src/orchestrator/gemini-md-bus';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('../../../src/orchestrator/artifact-reader');
jest.mock('../../../src/orchestrator/gemini-md-bus');
jest.mock('fs-extra');

describe('WalkthroughAggregator', () => {
    let aggregator: WalkthroughAggregator;
    let mockReader: any;
    let mockBus: any;

    beforeEach(() => {
        jest.clearAllMocks();
        aggregator = new WalkthroughAggregator('/test/brain');
        mockReader = (aggregator as any).artifactReader;
        mockBus = (aggregator as any).messageBus;
    });

    describe('aggregatePhaseWalkthroughs', () => {
        it('should aggregate walkthroughs and write summary', async () => {
            // Mock artifacts
            const artifacts: any[] = [{
                agentRole: 'backend',
                conversationId: '123',
                brainDir: '/brain/123',
                task: { completedCount: 5, totalCount: 10, percentComplete: 50 },
                walkthrough: {
                    title: 'Test Walkthrough',
                    rawContent: '## Content',
                    screenshots: ['/path/to/img.png'],
                    recordings: [],
                    testResults: [{ status: 'pass' }, { status: 'fail' }],
                    sections: [{ heading: 'Section 1', level: 2 }]
                }
            }];

            mockReader.readMultipleAgents.mockResolvedValue(artifacts);

            // Mock state
            mockBus.getOrchestratorState.mockResolvedValue({
                currentPhase: { startedAt: '2023-01-01T00:00:00Z' }
            });

            const result = await aggregator.aggregatePhaseWalkthroughs(
                'Phase 1',
                [{ role: 'backend', conversationId: '123' }],
                '/output'
            );

            expect(result.phase).toBe('Phase 1');
            expect(result.completionCertificate.status).toBe('partial');
            expect(result.completionCertificate.metrics.totalTasks).toBe(10);
            expect(result.completionCertificate.metrics.testsPassed).toBe(1);

            expect(fs.ensureDir).toHaveBeenCalledWith('/output');
            expect(fs.writeFile).toHaveBeenCalledWith(
                path.join('/output', 'Phase 1-walkthrough-summary.md'),
                expect.stringContaining('# Phase Walkthrough Summary: Phase 1')
            );
        });

        it('should handle zero tasks/progress gracefully', async () => {
            mockReader.readMultipleAgents.mockResolvedValue([]);
            mockBus.getOrchestratorState.mockResolvedValue(null);

            const result = await aggregator.aggregatePhaseWalkthroughs('Phase 0', []);

            expect(result.completionCertificate.status).toBe('in_progress'); // Default if 0%
            expect(result.completionCertificate.metrics.totalTasks).toBe(0);
        });
    });
});
