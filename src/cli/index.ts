#!/usr/bin/env node
/**
 * cc-mirror CLI Entry Point
 * PRD v2.0 - Antigravity Provider with State Bridge
 */

import { Command } from 'commander';
import { registerListAgSessionsCommand } from './list-ag-sessions';
import { registerShowAgSessionCommand } from './show-ag-session';
import { registerSendCommand } from './send';

const program = new Command();

program
    .name('cc-mirror')
    .description('Claude Code CLI with Antigravity Provider Integration')
    .version('0.1.0');

// Register commands
registerListAgSessionsCommand(program);
registerShowAgSessionCommand(program);
registerSendCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

