---
id: "user_friendly_cli_errors"
source: "cc-mirror Antigravity State Bridge TDD v1.0"
tags: ["typescript", "cli", "ux", "chalk", "error-handling"]
---

## Problem

Technical errors like "ENOENT" or "Parse failed" are confusing to users. Need to provide actionable error messages with clear solutions, color-coded for severity, and helpful next steps.

## Solution

```typescript
import chalk from 'chalk';

/**
 * Base error class for cc-mirror Antigravity provider.
 */
export class AntigravityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AntigravityError';
  }
}

export class SessionNotFoundError extends AntigravityError {
  constructor(public readonly sessionId?: string) {
    super(
      sessionId 
        ? `Session '${sessionId}' not found`
        : 'No Antigravity sessions found',
      'SESSION_NOT_FOUND',
      !sessionId // Recoverable if no specific session requested
    );
  }
}

export class SessionParseError extends AntigravityError {
  constructor(public readonly filePath: string, cause?: Error) {
    super(
      `Failed to parse session file: ${filePath}`,
      'SESSION_PARSE_ERROR',
      true // Recoverable - can proceed without context
    );
    if (cause) {
      this.cause = cause;
    }
  }
}

export class OAuthError extends AntigravityError {
  constructor(message: string, cause?: Error) {
    super(message, 'OAUTH_ERROR', false);
    if (cause) {
      this.cause = cause;
    }
  }
}

export class QuotaExhaustedError extends AntigravityError {
  constructor(public readonly accountsChecked: number) {
    super(
      `All ${accountsChecked} accounts have exhausted their quota`,
      'QUOTA_EXHAUSTED',
      false
    );
  }
}

/**
 * User-friendly error message formatter with color coding and actionable advice.
 */
export class CLIErrorHandler {
  /**
   * Display a user-friendly error message for an error object.
   * Returns exit code (0 = success, 1 = error, 2 = usage error).
   */
  handleError(error: Error): number {
    if (error instanceof SessionNotFoundError) {
      return this.handleSessionNotFound(error);
    }

    if (error instanceof SessionParseError) {
      return this.handleSessionParse(error);
    }

    if (error instanceof OAuthError) {
      return this.handleOAuth(error);
    }

    if (error instanceof QuotaExhaustedError) {
      return this.handleQuotaExhausted(error);
    }

    // Generic error
    return this.handleGenericError(error);
  }

  private handleSessionNotFound(error: SessionNotFoundError): number {
    if (error.sessionId) {
      // User explicitly requested a session that doesn't exist - CRITICAL
      console.error(chalk.red('\n❌ Session Not Found\n'));
      console.error(`The session ${chalk.cyan(error.sessionId)} could not be found.\n`);
      
      console.error(chalk.yellow('Possible causes:'));
      console.error('  -  Session ID was mistyped');
      console.error('  -  Session was deleted by Antigravity IDE');
      console.error('  -  Session is in a non-standard location\n');
      
      console.error(chalk.blue('💡 Next steps:'));
      console.error(`  1. Run ${chalk.cyan('cc-mirror list-ag-sessions')} to see available sessions`);
      console.error(`  2. Check for typos in the session ID`);
      console.error(`  3. Verify AG_SESSION_DIR environment variable if set\n`);
      
      return 1; // Error exit code
    } else {
      // No sessions found at all - WARNING (can continue)
      console.warn(chalk.yellow('\n⚠️  No Antigravity Sessions Found\n'));
      console.warn('cc-mirror could not find any Antigravity IDE session files.\n');
      
      console.warn(chalk.yellow('Possible causes:'));
      console.warn('  -  You haven\'t used Antigravity IDE yet');
      console.warn('  -  Sessions are stored in a non-standard location');
      console.warn('  -  Session files were deleted\n');
      
      console.info(chalk.blue('💡 Solutions:'));
      console.info('  -  Complete a task in Antigravity IDE first');
      console.info('  -  Set AG_SESSION_DIR environment variable:');
      console.info(`    ${chalk.gray('export AG_SESSION_DIR=/path/to/sessions')}`);
      console.info(`  • Run command without ${chalk.cyan('--continue-from-ag')} flag\n`);
      
      console.info(chalk.green('✓ Continuing without Antigravity context...\n'));
      
      return 0; // Success - degraded mode
    }
  }

  private handleSessionParse(error: SessionParseError): number {
    console.warn(chalk.yellow('\n⚠️  Session Parse Failed\n'));
    console.warn(`Could not parse session file: ${chalk.gray(error.filePath)}\n`);
    
    console.warn(chalk.yellow('Possible causes:'));
    console.warn('  -  Antigravity IDE updated their session format');
    console.warn('  -  Session file is corrupted');
    console.warn('  -  File contains invalid JSON\n');
    
    console.info(chalk.blue('💡 Solutions:'));
    console.info(`  • Update cc-mirror: ${chalk.cyan('npm update -g cc-mirror')}`);
    console.info(`  • Try a different session: ${chalk.cyan('cc-mirror list-ag-sessions')}`);
    console.info('  -  Report issue with session file attached:\n');
    console.info(`    ${chalk.gray('https://github.com/numman-ali/cc-mirror/issues')}\n`);
    
    console.info(chalk.green('✓ Continuing without Antigravity context...\n'));
    
    return 0; // Success - degraded mode
  }

  private handleOAuth(error: OAuthError): number {
    console.error(chalk.red('\n❌ Authentication Failed\n'));
    console.error(error.message + '\n');
    
    console.error(chalk.yellow('Common issues:'));
    console.error('  -  Browser did not complete OAuth flow');
    console.error('  -  Callback server port (51121) is blocked');
    console.error('  -  Google account does not have Antigravity access');
    console.error('  -  Network connectivity issues\n');
    
    console.info(chalk.blue('💡 Solutions:'));
    console.info(`  1. Try logging in again: ${chalk.cyan('cc-mirror antigravity login')}`);
    console.info('  2. Check firewall settings (allow localhost:51121)');
    console.info('  3. Ensure Google account has Antigravity IDE enabled');
    console.info('  4. Check network connection and proxy settings\n');
    
    console.info(chalk.gray('If the browser does not open automatically:'));
    console.info(chalk.gray('  -  Manually copy the auth URL from the terminal'));
    console.info(chalk.gray('  -  Paste it into your browser\n'));
    
    return 1; // Error exit code
  }

  private handleQuotaExhausted(error: QuotaExhaustedError): number {
    console.error(chalk.red('\n❌ Quota Exhausted\n'));
    console.error(`All ${error.accountsChecked} authenticated account(s) have reached their quota limit.\n`);
    
    console.error(chalk.yellow('Why this happens:'));
    console.error('  -  Free tier: 50 requests per 7 days');
    console.error('  -  Standard tier: 100 requests per 5 hours');
    console.error('  -  Quota resets automatically after the time window\n');
    
    console.info(chalk.blue('💡 Solutions:'));
    console.info('  1. Wait for quota to reset (check account status):');
    console.info(`     ${chalk.cyan('cc-mirror antigravity status')}`);
    console.info('  2. Add another Google account:');
    console.info(`     ${chalk.cyan('cc-mirror antigravity login')}`);
    console.info('  3. Use a different provider temporarily:');
    console.info(`     ${chalk.cyan('cc-mirror send --provider z-ai "your message"')}`);
    console.info('  4. Upgrade to Standard tier (if on Free):\n');
    console.info(`     ${chalk.gray('https://cloud.google.com/antigravity/pricing')}\n`);
    
    return 1; // Error exit code
  }

  private handleGenericError(error: Error): number {
    console.error(chalk.red('\n❌ Unexpected Error\n'));
    console.error(error.message + '\n');
    
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('Stack trace:'));
      console.error(chalk.gray(error.stack) + '\n');
    }
    
    console.info(chalk.blue('💡 Next steps:'));
    console.info('  1. Check your configuration:');
    console.info(`     ${chalk.cyan('cc-mirror config show')}`);
    console.info('  2. Try with debug mode:');
    console.info(`     ${chalk.cyan('DEBUG=* cc-mirror send ...')}`);
    console.info('  3. Report the issue:');
    console.info(`     ${chalk.gray('https://github.com/numman-ali/cc-mirror/issues')}\n`);
    
    return 1; // Error exit code
  }

  /**
   * Display a success message with optional next steps.
   */
  displaySuccess(message: string, details?: string[]): void {
    console.log(chalk.green(`\n✅ ${message}\n`));
    
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(`   ${detail}`);
      });
      console.log('');
    }
  }

  /**
   * Display an informational message.
   */
  displayInfo(message: string): void {
    console.info(chalk.blue(`\n💡 ${message}\n`));
  }

  /**
   * Display a warning that doesn't stop execution.
   */
  displayWarning(message: string, advice?: string): void {
    console.warn(chalk.yellow(`\n⚠️  ${message}`));
    
    if (advice) {
      console.warn(chalk.yellow(`\n💡 ${advice}\n`));
    } else {
      console.warn('');
    }
  }
}

// Usage in CLI commands:
async function sendCommand(message: string, options: any) {
  const errorHandler = new CLIErrorHandler();

  try {
    // ... command logic ...
    
    errorHandler.displaySuccess('Message sent successfully!', [
      'Session ID: abc123',
      'Tokens used: 1,234',
      'Model: gemini-2.0-flash-thinking-exp'
    ]);
  } catch (error) {
    const exitCode = errorHandler.handleError(error as Error);
    process.exit(exitCode);
  }
}

// Example: Warning without error
function warnAboutStaleSession() {
  const handler = new CLIErrorHandler();
  handler.displayWarning(
    'This session is 3 days old. Context may be outdated.',
    'Consider starting a fresh session in Antigravity IDE.'
  );
}
```

## Key Techniques

- **Color-coded severity**: Red (❌) for errors, yellow (⚠️) for warnings, green (✅) for success, blue (💡) for tips. Users can instantly assess seriousness.

- **Structured error format**: Every error follows pattern: "What happened" → "Why it happened" → "How to fix it". This reduces support requests.

- **Actionable commands**: Don't say "authenticate again", say "Run `cc-mirror antigravity login`". Copy-pasteable solutions.

- **Progressive disclosure**: Show basic message first, then causes, then solutions. Users can stop reading once they find their answer.

- **Recoverable vs non-recoverable**: Errors have `recoverable` flag. Recoverable errors show warnings and continue, non-recoverable exit with code 1.

- **Exit code semantics**: 0 = success (including degraded mode), 1 = error, 2 = usage error. Follows Unix conventions for scripting.

- **Debug mode support**: Stack traces only shown if `DEBUG=*` environment variable set. Keeps output clean for normal users.

- **Link to documentation**: Every error includes relevant docs or issue tracker link. Users can self-serve.

## References

- [Chalk Documentation](https://github.com/chalk/chalk) - Terminal colors
- [Unix Exit Codes](https://tldp.org/LDP/abs/html/exitcodes.html) - Standard conventions
- [Error Message Guidelines](https://developers.google.com/tech-writing/error-messages) - Writing good errors
