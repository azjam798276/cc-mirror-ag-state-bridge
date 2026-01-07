/**
 * send CLI Command with Antigravity Context Injection
 * PRD v2.0 Feature 4: --continue-from-ag and --ag-session flags
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SessionDiscovery } from '../providers/antigravity/state-bridge/session-discovery';
import { SessionParser } from '../providers/antigravity/state-bridge/session-parser';
import { ContextInjector } from '../providers/antigravity/state-bridge/context-injector';

/**
 * Register `send` command with AG context injection flags
 * 
 * PRD v2.0 Spec:
 * - `cc-mirror send --continue-from-ag "message"` - auto-detect latest session
 * - `cc-mirror send --ag-session <id> "message"` - use specific session
 */
export function registerSendCommand(program: Command): void {
    program
        .command('send <message>')
        .description('Send a message to the AI provider with optional Antigravity context')
        .option('--continue-from-ag', 'Continue from the latest Antigravity session')
        .option('--ag-session <sessionId>', 'Continue from a specific Antigravity session')
        .option('--dry-run', 'Show what would be sent without actually sending')
        .option('--json', 'Output the constructed message as JSON')
        .action(async (message: string, options) => {
            try {
                const messages: any[] = [];
                let sessionInfo: { id: string; goal: string } | null = null;

                // Handle AG context injection
                if (options.continueFromAg || options.agSession) {
                    const discovery = new SessionDiscovery();
                    const parser = new SessionParser();
                    const injector = new ContextInjector();

                    // Get session (latest or by ID)
                    const session = options.agSession
                        ? await discovery.getSessionById(options.agSession)
                        : await discovery.getLatestSession();

                    if (!session) {
                        if (options.agSession) {
                            console.error(chalk.red(`❌ Session not found: ${options.agSession}`));
                            console.log(chalk.blue('💡 Tip: Run `cc-mirror list-ag-sessions` to see available sessions'));
                            process.exit(1);
                        } else {
                            console.log(chalk.yellow('⚠️  No Antigravity sessions found. Proceeding without context.'));
                            console.log(chalk.blue('💡 Tip: Complete a task in Antigravity IDE first.\n'));
                        }
                    } else {
                        // Parse and inject context
                        const parsed = await parser.parse(session.filePath);

                        // Get context message
                        const contextResult = injector.injectContext(
                            [{ role: 'user' as const, content: message }],
                            parsed
                        );

                        // Use injected messages
                        messages.push(...contextResult);
                        sessionInfo = { id: parsed.sessionId, goal: parsed.goal };

                        // Log context injection info
                        console.log(chalk.green('✅ Loaded Antigravity context'));
                        console.log(chalk.gray(`   Session: ${parsed.sessionId}`));
                        console.log(chalk.gray(`   Goal: ${parsed.goal.substring(0, 50)}${parsed.goal.length > 50 ? '...' : ''}`));
                        console.log(chalk.gray(`   Progress: ${parsed.completedSteps.length}/${parsed.planSteps.length} steps\n`));
                    }
                }

                // If no AG context, just use the user message
                if (messages.length === 0) {
                    messages.push({ role: 'user', content: message });
                }

                // Dry run mode
                if (options.dryRun || options.json) {
                    console.log(chalk.cyan('\n📤 Message payload:\n'));
                    console.log(JSON.stringify(messages, null, 2));

                    if (options.dryRun) {
                        console.log(chalk.yellow('\n⚠️  Dry run - message not sent'));
                    }
                    return;
                }

                // TODO: Actually send to provider
                // For now, show what would be sent
                console.log(chalk.cyan('📤 Ready to send to provider:\n'));

                for (const msg of messages) {
                    const roleColor = msg.role === 'system' ? chalk.magenta :
                        msg.role === 'user' ? chalk.blue : chalk.green;
                    console.log(roleColor(`[${msg.role.toUpperCase()}]`));

                    // Truncate long content for display
                    const content = msg.content.length > 500
                        ? msg.content.substring(0, 500) + chalk.dim('...[truncated]')
                        : msg.content;
                    console.log(content);
                    console.log('');
                }

                console.log(chalk.dim('─'.repeat(60)));
                console.log(chalk.yellow('⚠️  Provider integration pending - message displayed but not sent'));
                console.log(chalk.blue('💡 Use --dry-run to preview messages without this warning'));

            } catch (error) {
                console.error(chalk.red('❌ Failed to send message:'), (error as Error).message);
                process.exit(1);
            }
        });
}

export { registerSendCommand as registerCommand };
