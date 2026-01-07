/**
 * CLI Commands for Antigravity State Bridge
 * PRD v2.0 Feature 4: CLI Commands (User-Facing)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SessionDiscovery } from '../providers/antigravity/state-bridge/session-discovery';
import { SessionParser } from '../providers/antigravity/state-bridge/session-parser';

/**
 * Register `list-ag-sessions` command
 * 
 * PRD Spec:
 * ```
 * cc-mirror list-ag-sessions
 * 
 * Output:
 * Recent Antigravity Sessions:
 * 
 * 1. session-abc123 (2 hours ago)
 *    Goal: Build REST API with authentication
 *    Progress: 3/5 steps completed
 *    Modified: 8 files
 * ```
 */
export function registerListAgSessionsCommand(program: Command): void {
    program
        .command('list-ag-sessions')
        .description('List available Antigravity IDE sessions')
        .option('-n, --limit <number>', 'Maximum number of sessions to display', '10')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
            try {
                const discovery = new SessionDiscovery();
                const sessions = await discovery.findSessions();

                if (sessions.length === 0) {
                    console.log(chalk.yellow('⚠️  No Antigravity sessions found.\n'));
                    console.log(chalk.dim('Possible causes:'));
                    console.log(chalk.dim('  1. You haven\'t used Antigravity IDE yet'));
                    console.log(chalk.dim('  2. Sessions are in a non-standard location'));
                    console.log(chalk.dim('  3. Session files were deleted\n'));
                    console.log(chalk.blue('💡 Tip: Set AG_SESSION_DIR environment variable to specify custom path'));
                    return;
                }

                const limit = parseInt(options.limit, 10);
                const limitedSessions = sessions.slice(0, limit);

                if (options.json) {
                    console.log(JSON.stringify(limitedSessions, null, 2));
                    return;
                }

                console.log(chalk.bold.cyan('\n📋 Recent Antigravity Sessions:\n'));

                const parser = new SessionParser();

                for (let i = 0; i < limitedSessions.length; i++) {
                    const session = limitedSessions[i];
                    console.log(chalk.bold.white(`${i + 1}. ${session.sessionId}`) + chalk.dim(` (${session.ageString})`));

                    try {
                        const parsed = await parser.parse(session.filePath);

                        // Goal (truncate if too long)
                        const goal = parsed.goal.length > 60
                            ? parsed.goal.substring(0, 57) + '...'
                            : parsed.goal;
                        console.log(chalk.gray(`   Goal: `) + chalk.white(goal));

                        // Progress
                        const completed = parsed.completedSteps.length;
                        const total = parsed.planSteps.length;
                        if (total > 0) {
                            const percentage = Math.round((completed / total) * 100);
                            const progressBar = createProgressBar(percentage);
                            console.log(chalk.gray(`   Progress: `) + progressBar + chalk.white(` ${completed}/${total} steps`));
                        }

                        // Files modified
                        if (parsed.filesModified.length > 0) {
                            console.log(chalk.gray(`   Modified: `) + chalk.white(`${parsed.filesModified.length} files`));
                        }
                    } catch (e) {
                        console.log(chalk.yellow(`   ⚠️  Could not parse session details`));
                    }

                    console.log(''); // Blank line between sessions
                }

                // Usage hint
                console.log(chalk.dim('─'.repeat(60)));
                console.log(chalk.blue('💡 Use: ') + chalk.white('cc-mirror send --ag-session <id> "message"'));
                console.log(chalk.blue('   Or:  ') + chalk.white('cc-mirror send --continue-from-ag "message"') + chalk.dim(' (uses latest)'));

            } catch (error) {
                console.error(chalk.red('❌ Failed to list sessions:'), (error as Error).message);
                process.exit(1);
            }
        });
}

/**
 * Create visual progress bar
 */
function createProgressBar(percentage: number): string {
    const width = 15;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}]`;
}

export { registerListAgSessionsCommand as registerCommand };
