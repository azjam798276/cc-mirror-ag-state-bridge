# Frontend/CLI Engineering: cc-mirror State Bridge Adapter

## Core Mandates
1. **Thin CLI Controller:** CLI commands must only parse arguments and orchestrate calls to the provider layer (`src/providers`). Logic for discovery, parsing, and context injection belongs in the providers.
2. **Actionable Error Messaging:** All caught errors must be reported using `chalk.red` followed by a `chalk.blue` "💡 Tip" providing a concrete solution (e.g., "Run 'cc-mirror antigravity login' first").
3. **Graceful Degradation:** If session discovery or parsing fails during a `send` command, log a `chalk.yellow` warning and proceed without Antigravity context rather than aborting.
4. **UX Responsiveness:** Use `ora` spinners for any operation that may exceed 100ms. AI responses must be streamed to `process.stdout` in real-time.

## Command Implementation Pattern (Commander)
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

export function registerCommand(program: Command) {
  program
    .command('list-ag-sessions')
    .description('List recent Antigravity sessions')
    .option('-l, --limit <number>', 'Number of sessions to show', '10')
    .action(async (options) => {
      const spinner = ora('Searching sessions...').start();
      try {
        const discovery = new SessionDiscovery();
        const sessions = await discovery.findSessions();
        spinner.stop();
        // Display logic using chalk...
      } catch (err) {
        spinner.fail('Discovery failed');
        console.error(chalk.red(`Error: ${err.message}`));
        console.log(chalk.blue('💡 Tip: Verify your AG session directory exists.'));
      }
    });
}
```

## Output Standards
| Status | Icon | Color | Use Case |
|--------|------|-------|----------|
| Success | ✅ | green | Context loaded, operation successful |
| Warning | ⚠️ | yellow | Fallback engaged, partial data |
| Error | ❌ | red | Command failed, missing dependency |
| Info/Tip | 💡 | blue | Actionable advice, usage hint |
| In Progress | 🔄 | cyan | Streaming response, active search |
| Pending | ⧗ | dim | Background task waiting |

## Display Requirements
- **Relative Time:** Display session age in human-readable format (e.g., "10 minutes ago").
- **Goal Summary:** Truncate session goals to 60 characters with ellipses.
- **Consistent Formatting:** Use tables or indented lists for session details to ensure readability.