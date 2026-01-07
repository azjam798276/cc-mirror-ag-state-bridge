/**
 * Real-time CLI Dashboard
 * 
 * Shows live agent status with progress bars in terminal.
 * Refreshes every 5 seconds with color-coded status.
 * 
 * Features:
 * - Real-time agent status matrix
 * - Progress bars for each agent
 * - Color-coded status (green=done, yellow=active, red=blocked)
 * - GEMINI.md dispatch queue display
 * - Idle time tracking
 */

import * as readline from 'readline';
import BrainPoller, { AgentStatus, AgentConfig } from './brain-poller';
import GeminiMdMessageBus, { OrchestratorState } from './gemini-md-bus';

// ============================================================================
// ANSI Color Codes
// ============================================================================

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Background
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

// ============================================================================
// Dashboard Configuration
// ============================================================================

export interface DashboardConfig {
    refreshIntervalMs: number;
    showDispatchQueue: boolean;
    showIdleTime: boolean;
    agents: AgentConfig[];
}

// ============================================================================
// CLI Dashboard
// ============================================================================

export class CLIDashboard {
    private config: DashboardConfig;
    private brainPoller: BrainPoller;
    private messageBus: GeminiMdMessageBus;
    private running: boolean = false;
    private refreshInterval: NodeJS.Timeout | null = null;
    private lastStatuses: AgentStatus[] = [];
    private startTime: Date = new Date();

    constructor(config: Partial<DashboardConfig> = {}) {
        this.config = {
            refreshIntervalMs: config.refreshIntervalMs ?? 5000,
            showDispatchQueue: config.showDispatchQueue ?? true,
            showIdleTime: config.showIdleTime ?? true,
            agents: config.agents ?? [],
        };

        this.brainPoller = new BrainPoller({
            agents: this.config.agents,
            autoInjectContinuation: false, // Dashboard is read-only
        });

        this.messageBus = new GeminiMdMessageBus();
    }

    // --------------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------------

    async start(): Promise<void> {
        if (this.running) return;

        this.running = true;
        this.startTime = new Date();

        // Hide cursor
        process.stdout.write('\x1b[?25l');

        // Clear screen
        this.clearScreen();

        // Initial render
        await this.refresh();

        // Set up refresh interval
        this.refreshInterval = setInterval(async () => {
            await this.refresh();
        }, this.config.refreshIntervalMs);

        // Handle keyboard input
        this.setupKeyboardHandler();
    }

    stop(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Show cursor
        process.stdout.write('\x1b[?25h');

        // Clear screen
        this.clearScreen();

        this.running = false;
    }

    private setupKeyboardHandler(): void {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', (str, key) => {
            if (key.ctrl && key.name === 'c') {
                this.stop();
                process.exit(0);
            }

            if (key.name === 'q') {
                this.stop();
                process.exit(0);
            }

            if (key.name === 'r') {
                this.refresh();
            }
        });
    }

    // --------------------------------------------------------------------------
    // Rendering
    // --------------------------------------------------------------------------

    private clearScreen(): void {
        process.stdout.write('\x1b[2J\x1b[H');
    }

    private moveCursor(x: number, y: number): void {
        process.stdout.write(`\x1b[${y};${x}H`);
    }

    async refresh(): Promise<void> {
        // Fetch data
        this.lastStatuses = await this.brainPoller.pollAllAgents();
        const orchestratorState = await this.messageBus.getOrchestratorState();

        // Clear and render
        this.clearScreen();
        this.renderHeader();
        this.renderAgentMatrix(this.lastStatuses);

        if (this.config.showDispatchQueue && orchestratorState) {
            this.renderDispatchQueue(orchestratorState);
        }

        this.renderFooter();
    }

    private renderHeader(): void {
        const now = new Date();
        const uptime = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
        const uptimeStr = this.formatDuration(uptime * 1000);

        console.log(colors.bold + colors.cyan);
        console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║              🧠 ANTIGRAVITY MULTI-AGENT COORDINATION DASHBOARD              ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
        console.log(colors.reset);
        console.log(`  ${colors.dim}Last refresh: ${now.toLocaleTimeString()} | Uptime: ${uptimeStr} | Refresh: ${this.config.refreshIntervalMs / 1000}s${colors.reset}`);
        console.log('');
    }

    private renderAgentMatrix(statuses: AgentStatus[]): void {
        console.log(colors.bold + '  AGENT STATUS MATRIX' + colors.reset);
        console.log('  ' + '─'.repeat(74));
        console.log(`  ${colors.dim}${'Agent'.padEnd(22)} ${'Progress'.padEnd(24)} ${'Tasks'.padEnd(10)} ${'Idle'.padEnd(10)} Status${colors.reset}`);
        console.log('  ' + '─'.repeat(74));

        for (const status of statuses) {
            this.renderAgentRow(status);
        }

        console.log('  ' + '─'.repeat(74));

        // Summary row
        const totalTasks = statuses.reduce((sum, s) => sum + s.totalTasks, 0);
        const completedTasks = statuses.reduce((sum, s) => sum + s.completedTasks, 0);
        const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const completedAgents = statuses.filter(s => s.isComplete).length;
        const idleAgents = statuses.filter(s => s.isIdle && !s.isComplete).length;

        console.log(`  ${colors.bold}TOTAL${colors.reset}${' '.repeat(17)} ${this.renderProgressBar(completedTasks, totalTasks, 20)} ${(completedTasks + '/' + totalTasks).padEnd(10)} ${(completedAgents + '/' + statuses.length + ' done').padEnd(10)} ${idleAgents} idle`);
        console.log('');
    }

    private renderAgentRow(status: AgentStatus): void {
        // Agent name
        const agentName = status.role.padEnd(20);

        // Progress bar
        const progressBar = this.renderProgressBar(status.completedTasks, status.totalTasks, 20);

        // Tasks count
        const tasksCount = status.totalTasks > 0
            ? `${status.completedTasks}/${status.totalTasks}`.padEnd(10)
            : '-'.padEnd(10);

        // Idle time
        let idleTime = '-'.padEnd(10);
        if (this.config.showIdleTime && status.idleDurationMs > 0) {
            idleTime = this.formatDuration(status.idleDurationMs).padEnd(10);
        }

        // Status with color
        let statusText = '';
        let statusColor = colors.reset;

        if (status.isComplete) {
            statusText = '✅ DONE';
            statusColor = colors.green;
        } else if (status.isIdle) {
            statusText = '⚠️  IDLE';
            statusColor = colors.yellow;
        } else if (status.totalTasks === 0) {
            statusText = '⬜ NO TASKS';
            statusColor = colors.dim;
        } else {
            statusText = '🔄 ACTIVE';
            statusColor = colors.cyan;
        }

        console.log(`  ${agentName} ${progressBar} ${tasksCount} ${idleTime} ${statusColor}${statusText}${colors.reset}`);
    }

    private renderProgressBar(completed: number, total: number, width: number = 20): string {
        if (total === 0) {
            return colors.dim + '[' + '░'.repeat(width) + ']' + colors.reset;
        }

        const filled = Math.round((completed / total) * width);
        const empty = width - filled;
        const percent = Math.round((completed / total) * 100);

        let barColor = colors.yellow;
        if (percent === 100) barColor = colors.green;
        else if (percent >= 75) barColor = colors.cyan;

        return barColor + '[' + '█'.repeat(filled) + colors.dim + '░'.repeat(empty) + barColor + ']' + colors.reset;
    }

    private renderDispatchQueue(state: OrchestratorState): void {
        console.log(colors.bold + '  GEMINI.md DISPATCH QUEUE' + colors.reset);
        console.log('  ' + '─'.repeat(74));
        console.log(`  ${colors.dim}Phase: ${state.currentPhase.phase} | Status: ${state.currentPhase.status}${colors.reset}`);
        console.log('');

        for (const task of state.currentPhase.tasks) {
            let icon = '⬜';
            let taskColor = colors.dim;

            if (task.status === 'complete') {
                icon = '✅';
                taskColor = colors.green;
            } else if (task.status === 'in_progress') {
                icon = '🔄';
                taskColor = colors.cyan;
            } else if (task.status === 'dispatched') {
                icon = '📤';
                taskColor = colors.yellow;
            } else if (task.status === 'blocked') {
                icon = '🚫';
                taskColor = colors.red;
            }

            console.log(`  ${icon} ${taskColor}${task.id}${colors.reset}: ${task.agent.padEnd(18)} ${task.description.slice(0, 40)}`);
        }

        console.log('');
    }

    private renderFooter(): void {
        console.log('  ' + '─'.repeat(74));
        console.log(`  ${colors.dim}Press [q] to quit | [r] to refresh | [Ctrl+C] to exit${colors.reset}`);
    }

    // --------------------------------------------------------------------------
    // Utilities
    // --------------------------------------------------------------------------

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// ============================================================================
// CLI Runner
// ============================================================================

async function main() {
    // CC-Mirror agents
    const agents: AgentConfig[] = [
        { agentId: 'orchestrator', conversationId: 'e20afd38-f5dc-4f4c-aadc-a720cc401eaf', role: 'orchestrator', brainDir: '' },
        { agentId: 'backend', conversationId: '15b9c503-6ccc-4d27-be08-680a3b9c0af2', role: 'backend-engineer', brainDir: '' },
        { agentId: 'security', conversationId: '64a8119a-82df-466d-b1ef-6a968f8c02f2', role: 'security-engineer', brainDir: '' },
        { agentId: 'qa', conversationId: '5858eac3-c35a-44e1-9b13-8023ddcd423d', role: 'qa-engineer', brainDir: '' },
        { agentId: 'devops', conversationId: '91ccd3cd-586f-4f0d-b490-7fb42ceed5b2', role: 'devops-engineer', brainDir: '' },
        { agentId: 'director', conversationId: '5c053cb6-0934-4f88-9ab9-19aebdecd1a1', role: 'engineering-director', brainDir: '' },
    ];

    const dashboard = new CLIDashboard({
        refreshIntervalMs: 5000,
        showDispatchQueue: true,
        showIdleTime: true,
        agents,
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        dashboard.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        dashboard.stop();
        process.exit(0);
    });

    await dashboard.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default CLIDashboard;
