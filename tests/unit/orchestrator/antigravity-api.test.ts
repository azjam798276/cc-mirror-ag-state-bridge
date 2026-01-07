
import {
    injectViaFile,
    consumeContinuationPrompt,
    injectViaCLI,
    injectContinuation,
    wakeIdleAgents,
    ContinuationPrompt
} from '../../../src/orchestrator/antigravity-api';
import * as fs from 'fs-extra';
import * as path from 'path';
// os mock handles import
import * as child_process from 'child_process';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('os', () => ({
    homedir: jest.fn(() => '/mock/home')
}));

describe('Antigravity API', () => {
    const mockHomedir = '/mock/home';
    const mockBrainDir = '/mock/home/.gemini/antigravity/brain/conv-1';

    beforeEach(() => {
        jest.clearAllMocks();
        // Suppress console errors
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    const mockPrompt: ContinuationPrompt = {
        agentId: 'A1',
        conversationId: 'conv-1',
        prompt: 'Continue working'
    };

    describe('injectViaFile', () => {
        it('should write prompt file successfully', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
            (fs.writeJSON as unknown as jest.Mock).mockResolvedValue(undefined);

            const result = await injectViaFile('conv-1', mockPrompt);

            expect(result.success).toBe(true);
            expect(result.method).toBe('file');
            expect(fs.ensureDir).toHaveBeenCalledWith(mockBrainDir);
            expect(fs.writeJSON).toHaveBeenCalledWith(
                path.join(mockBrainDir, '.continuation-prompt'),
                expect.objectContaining({
                    ...mockPrompt,
                    injectionMethod: 'file'
                }),
                { spaces: 2 }
            );
        });

        it('should return failure on fs error', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockRejectedValue(new Error('Write failed'));

            const result = await injectViaFile('conv-1', mockPrompt);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Write failed');
        });
    });

    describe('consumeContinuationPrompt', () => {
        it('should return content and delete file if exists', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
            (fs.readJSON as unknown as jest.Mock).mockResolvedValue(mockPrompt);
            (fs.remove as unknown as jest.Mock).mockResolvedValue(undefined);

            const content = await consumeContinuationPrompt('conv-1');

            expect(content).toEqual(mockPrompt);
            expect(fs.remove).toHaveBeenCalledWith(path.join(mockBrainDir, '.continuation-prompt'));
        });

        it('should return null if file missing', async () => {
            (fs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
            const content = await consumeContinuationPrompt('conv-1');
            expect(content).toBeNull();
        });

        it('should return null on error', async () => {
            (fs.pathExists as unknown as jest.Mock).mockRejectedValue(new Error('Read failed'));
            const content = await consumeContinuationPrompt('conv-1');
            expect(content).toBeNull();
        });
    });

    describe('injectViaCLI', () => {
        it('should fail if CLI not found', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((...args) => {
                const cb = args[args.length - 1];
                const cmd = args[0];
                if (cmd.includes('which')) {
                    cb(null, { stdout: '' });
                }
            });

            const result = await injectViaCLI('conv-1', mockPrompt);
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should fail if CLI execution errors', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((...args) => {
                const cb = args[args.length - 1];
                const cmd = args[0];
                if (cmd.includes('which')) {
                    cb(null, { stdout: '/usr/bin/antigravity' });
                } else {
                    cb(null, { stdout: '', stderr: 'CLI Error' });
                }
            });

            const result = await injectViaCLI('conv-1', mockPrompt);
            expect(result.success).toBe(false);
            expect(result.message).toContain('CLI error');
        });

        it('should succeed if CLI runs', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((...args) => {
                const cb = args[args.length - 1];
                const cmd = args[0];
                if (cmd.includes('which')) {
                    cb(null, { stdout: '/usr/bin/antigravity' });
                } else {
                    cb(null, { stdout: 'Message sent', stderr: '' });
                }
            });

            const result = await injectViaCLI('conv-1', mockPrompt);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Message sent');
        });
    });

    describe('injectContinuation (Fallback)', () => {
        it('should use file method if successful', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
            (fs.writeJSON as unknown as jest.Mock).mockResolvedValue(undefined);

            const result = await injectContinuation('conv-1', mockPrompt);
            expect(result.method).toBe('file');
            expect(result.success).toBe(true);
        });

        it('should try CLI if file fails', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockRejectedValue(new Error('File fail'));

            (child_process.exec as unknown as jest.Mock).mockImplementation((...args) => {
                const cb = args[args.length - 1];
                const cmd = args[0];
                if (cmd.includes('which')) {
                    cb(null, { stdout: '/usr/bin/antigravity' });
                } else {
                    cb(null, { stdout: 'Sent', stderr: '' });
                }
            });

            const result = await injectContinuation('conv-1', mockPrompt);
            expect(result.method).toBe('terminal');
            expect(result.success).toBe(true);
        });

        it('should fail if everything fails', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockRejectedValue(new Error('File fail'));

            (child_process.exec as unknown as jest.Mock).mockImplementation((...args) => {
                const cb = args[args.length - 1];
                cb(null, { stdout: '' }); // CLI not found
            });

            const result = await injectContinuation('conv-1', mockPrompt);
            expect(result.success).toBe(false);
            expect(result.message).toContain('All injection methods failed');
        });
    });

    describe('wakeIdleAgents', () => {
        it('should generate correct prompts for agents', async () => {
            (fs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);

            const agents = [
                { conversationId: 'c1', agentId: 'A1', currentTask: 'Task 1' },
                { conversationId: 'c2', agentId: 'A2' }
            ];

            await wakeIdleAgents(agents);

            expect(fs.writeJSON).toHaveBeenCalledTimes(2);

            expect(fs.writeJSON).toHaveBeenCalledWith(
                expect.stringContaining('c1'),
                expect.objectContaining({ prompt: expect.stringContaining('Task 1') }),
                expect.anything()
            );

            expect(fs.writeJSON).toHaveBeenCalledWith(
                expect.stringContaining('c2'),
                expect.objectContaining({ prompt: expect.stringContaining('next uncompleted task') }),
                expect.anything()
            );
        });
    });
});
