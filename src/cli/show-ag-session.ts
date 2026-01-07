/**
 * show-ag-session CLI Command
 * PRD v2.0 Feature 4, Command 4: Show Session Details
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SessionDiscovery } from '../providers/antigravity/state-bridge/session-discovery';
import { SessionParser } from '../providers/antigravity/state-bridge/session-parser';

/**
 * Register `show-ag-session` command
 * 
 * PRD Spec:
 * ```
 * cc-mirror show-ag-session session-abc123
 * 
 * Output:
 * Session: session-abc123
 * Created: 2026-01-07 08:00:00
 * Last Modified: 2026-01-07 10:30:00
 * 
 * Goal: Build REST API with authentication
 * 
 * Plan:
 * ✅ 1. Design database schema (completed 08:15)
 * ✅ 2. Implement user model (completed 08:45)
 * 🔄 4. Write API routes (in progress)
 * ⧗ 5. Add tests
 * 
 * Files Modified:
 * - src/models/user.js (created)
 * - src/middleware/auth.js (created)
 * ```
 */
export function registerShowAgSessionCommand(program: Command): void {
    program
        .command('show-ag-session <sessionId>')
        .description('Show detailed information for a specific Antigravity session')
        .option('--json', 'Output as JSON')
        .action(async (sessionId: string, options) => {
            try {
                const discovery = new SessionDiscovery();
                const session = await discovery.getSessionById(sessionId);

                if (!session) {
                    console.error(chalk.red(`❌ Session not found: ${sessionId}\n`));
                    console.log(chalk.dim('Available sessions:'));
                    const sessions = await discovery.findSessions();
                    sessions.slice(0, 5).forEach(s => {
                        console.log(chalk.dim(`  - ${s.sessionId}`));
                    });
                    console.log(chalk.blue('\n💡 Tip: Run `cc-mirror list-ag-sessions` to see all sessions'));
                    process.exit(1);
                }

                const parser = new SessionParser();
                const parsed = await parser.parse(session.filePath);

                if (options.json) {
                    console.log(JSON.stringify({
                        ...session,
                        ...parsed,
                        timestamp: session.timestamp.toISOString()
                    }, null, 2));
                    return;
                }

                // Header
                console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════'));
                console.log(chalk.bold.white(`  📋 Session: ${parsed.sessionId}`));
                console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));

                // Metadata
                console.log(chalk.gray('Last Modified: ') + chalk.white(session.timestamp.toLocaleString()));
                console.log(chalk.gray('Path: ') + chalk.dim(session.filePath));
                console.log('');

                // Goal
                console.log(chalk.bold.yellow('📎 Goal'));
                console.log(chalk.white(`  ${parsed.goal}`));
                console.log('');

                // Progress Summary
                const completed = parsed.completedSteps.length;
                const total = parsed.planSteps.length;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                console.log(chalk.bold.yellow('📊 Progress'));
                console.log(`  ${createProgressBar(percentage, 30)} ${completed}/${total} (${percentage}%)`);
                console.log('');

                // Plan Steps
                if (parsed.planSteps.length > 0) {
                    console.log(chalk.bold.yellow('📝 Plan'));
                    parsed.planSteps.forEach((step, i) => {
                        const icon = step.status === 'completed' ? chalk.green('✅') :
                            step.status === 'executing' ? chalk.blue('🔄') :
                                step.status === 'failed' ? chalk.red('❌') :
                                    chalk.gray('⧗');
                        const text = step.status === 'completed' ? chalk.green(step.action) :
                            step.status === 'executing' ? chalk.blue(step.action) :
                                step.status === 'failed' ? chalk.red(step.action) :
                                    chalk.gray(step.action);
                        console.log(`  ${icon} ${i + 1}. ${text}`);
                    });
                    console.log('');
                }

                // Files Modified
                if (parsed.filesModified.length > 0) {
                    console.log(chalk.bold.yellow('📁 Files Modified'));
                    parsed.filesModified.slice(0, 15).forEach(file => {
                        console.log(chalk.dim(`  - ${file}`));
                    });
                    if (parsed.filesModified.length > 15) {
                        console.log(chalk.dim(`  ... and ${parsed.filesModified.length - 15} more`));
                    }
                    console.log('');
                }

                // Variables
                if (Object.keys(parsed.variables).length > 0) {
                    console.log(chalk.bold.yellow('🔧 Variables'));
                    Object.entries(parsed.variables).forEach(([key, value]) => {
                        console.log(chalk.gray(`  - ${key}: `) + chalk.white(JSON.stringify(value)));
                    });
                    console.log('');
                }

                // Usage hint
                console.log(chalk.dim('─'.repeat(60)));
                console.log(chalk.blue('💡 Continue this session:'));
                console.log(chalk.white(`   cc-mirror send --ag-session ${parsed.sessionId} "your message"`));

            } catch (error) {
                console.error(chalk.red('❌ Failed to show session:'), (error as Error).message);
                process.exit(1);
            }
        });
}

function createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

export { registerShowAgSessionCommand as registerCommand };
