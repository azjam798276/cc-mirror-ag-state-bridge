/**
 * Antigravity API Integration - Message Injection
 * 
 * Provides methods to inject continuation prompts into Antigravity
 * conversations, either via:
 * 1. File-based injection (.continuation-prompt files)
 * 2. Simulated user input via Antigravity internal APIs (if available)
 * 
 * This module extends the brain-poller to actually wake idle agents.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface InjectionResult {
    success: boolean;
    method: 'file' | 'api' | 'terminal';
    message: string;
    timestamp: Date;
}

export interface ContinuationPrompt {
    agentId: string;
    conversationId: string;
    prompt: string;
    context?: {
        currentTask?: string;
        completedTasks?: number;
        totalTasks?: number;
        idleDurationMs?: number;
    };
}

// ============================================================================
// File-Based Injection (Most Reliable)
// ============================================================================

/**
 * Write a continuation prompt file to agent's brain directory.
 * Agent must be configured to poll for this file.
 */
export async function injectViaFile(
    conversationId: string,
    prompt: ContinuationPrompt
): Promise<InjectionResult> {
    const brainDir = path.join(
        os.homedir(),
        '.gemini',
        'antigravity',
        'brain',
        conversationId
    );

    const promptPath = path.join(brainDir, '.continuation-prompt');

    try {
        await fs.ensureDir(brainDir);

        const content = {
            ...prompt,
            timestamp: new Date().toISOString(),
            injectionMethod: 'file',
        };

        await fs.writeJSON(promptPath, content, { spaces: 2 });

        return {
            success: true,
            method: 'file',
            message: `Wrote continuation prompt to ${promptPath}`,
            timestamp: new Date(),
        };
    } catch (error) {
        return {
            success: false,
            method: 'file',
            message: `Failed to write continuation prompt: ${error}`,
            timestamp: new Date(),
        };
    }
}

/**
 * Read and delete a continuation prompt (for agent-side processing)
 */
export async function consumeContinuationPrompt(
    conversationId: string
): Promise<ContinuationPrompt | null> {
    const brainDir = path.join(
        os.homedir(),
        '.gemini',
        'antigravity',
        'brain',
        conversationId
    );

    const promptPath = path.join(brainDir, '.continuation-prompt');

    try {
        if (await fs.pathExists(promptPath)) {
            const content = await fs.readJSON(promptPath);
            await fs.remove(promptPath); // Delete after reading
            return content;
        }
        return null;
    } catch (error) {
        console.error(`Error consuming continuation prompt: ${error}`);
        return null;
    }
}

// ============================================================================
// Terminal-Based Injection (Experimental)
// ============================================================================

/**
 * Attempt to inject a message via Antigravity CLI (if available)
 * This is experimental and may not work depending on Antigravity version
 */
export async function injectViaCLI(
    conversationId: string,
    prompt: ContinuationPrompt
): Promise<InjectionResult> {
    try {
        // Check if antigravity CLI exists
        const { stdout: whichResult } = await execAsync('which antigravity 2>/dev/null || which jules 2>/dev/null || echo ""');

        const cliPath = whichResult.trim();

        if (!cliPath) {
            return {
                success: false,
                method: 'terminal',
                message: 'Antigravity CLI not found in PATH',
                timestamp: new Date(),
            };
        }

        // Attempt to send message (this is experimental)
        // The actual API may vary based on Antigravity version
        const { stdout, stderr } = await execAsync(
            `${cliPath} send --conversation ${conversationId} --message "${prompt.prompt.replace(/"/g, '\\"')}"`,
            { timeout: 10000 }
        );

        if (stderr) {
            return {
                success: false,
                method: 'terminal',
                message: `CLI error: ${stderr}`,
                timestamp: new Date(),
            };
        }

        return {
            success: true,
            method: 'terminal',
            message: `Sent via CLI: ${stdout}`,
            timestamp: new Date(),
        };
    } catch (error) {
        return {
            success: false,
            method: 'terminal',
            message: `CLI injection failed: ${error}`,
            timestamp: new Date(),
        };
    }
}

// ============================================================================
// WebSocket-Based Injection (Future)
// ============================================================================

/**
 * Connect to Antigravity's internal WebSocket server (if exposed)
 * This would allow real-time message injection
 * 
 * NOTE: This is a placeholder for future implementation
 */
export async function injectViaWebSocket(
    conversationId: string,
    prompt: ContinuationPrompt
): Promise<InjectionResult> {
    // Antigravity may expose a WebSocket server for IDE communication
    // Port discovery would be needed (likely in ~/.gemini/antigravity/config)

    return {
        success: false,
        method: 'api',
        message: 'WebSocket injection not yet implemented',
        timestamp: new Date(),
    };
}

// ============================================================================
// Smart Injection (Try Multiple Methods)
// ============================================================================

/**
 * Try multiple injection methods in order of reliability
 */
export async function injectContinuation(
    conversationId: string,
    prompt: ContinuationPrompt
): Promise<InjectionResult> {
    // Method 1: File-based (most reliable)
    const fileResult = await injectViaFile(conversationId, prompt);
    if (fileResult.success) {
        return fileResult;
    }

    // Method 2: CLI-based (experimental)
    const cliResult = await injectViaCLI(conversationId, prompt);
    if (cliResult.success) {
        return cliResult;
    }

    // Method 3: WebSocket (future)
    const wsResult = await injectViaWebSocket(conversationId, prompt);
    if (wsResult.success) {
        return wsResult;
    }

    // All methods failed
    return {
        success: false,
        method: 'file',
        message: 'All injection methods failed',
        timestamp: new Date(),
    };
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Inject continuation prompts to multiple agents
 */
export async function injectToMultipleAgents(
    prompts: ContinuationPrompt[]
): Promise<Map<string, InjectionResult>> {
    const results = new Map<string, InjectionResult>();

    await Promise.all(
        prompts.map(async (prompt) => {
            const result = await injectContinuation(prompt.conversationId, prompt);
            results.set(prompt.conversationId, result);
        })
    );

    return results;
}

/**
 * Wake all idle agents with a generic continuation message
 */
export async function wakeIdleAgents(
    agents: Array<{ conversationId: string; agentId: string; currentTask?: string }>
): Promise<Map<string, InjectionResult>> {
    const prompts: ContinuationPrompt[] = agents.map((agent) => ({
        agentId: agent.agentId,
        conversationId: agent.conversationId,
        prompt: agent.currentTask
            ? `Continue working on: ${agent.currentTask}. Check task.md for progress.`
            : `Check task.md for next uncompleted task. Update progress and continue work.`,
    }));

    return injectToMultipleAgents(prompts);
}

// ============================================================================
// Exports
// ============================================================================

export default {
    injectViaFile,
    injectViaCLI,
    injectViaWebSocket,
    injectContinuation,
    injectToMultipleAgents,
    wakeIdleAgents,
    consumeContinuationPrompt,
};
