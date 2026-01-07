
describe('Module Exports', () => {
    it('should export orchestrator components', async () => {
        const orchestrator = await import('../../src/orchestrator/index');
        expect(orchestrator).toBeDefined();
        // Add specific checks if possible, e.g. expect(orchestrator.BrainPoller).toBeDefined();
    });

    it('should export oauth components', async () => {
        const oauth = await import('../../src/providers/antigravity/oauth/index');
        expect(oauth).toBeDefined();
    });
});
