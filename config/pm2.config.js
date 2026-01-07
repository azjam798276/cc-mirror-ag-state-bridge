/**
 * PM2 Configuration for Orchestrator Daemon
 * 
 * Usage:
 *   pm2 start config/pm2.config.js
 *   pm2 stop cc-mirror-orchestrator
 *   pm2 logs cc-mirror-orchestrator
 *   pm2 monit
 */

module.exports = {
    apps: [
        {
            name: 'cc-mirror-orchestrator',
            script: 'npx',
            args: 'ts-node --transpile-only src/orchestrator/phase-detector.ts',
            cwd: '/home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge',

            // Auto-restart settings
            autorestart: true,
            watch: false,
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 5000,

            // Resource limits
            max_memory_restart: '500M',

            // Logging
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Environment
            env: {
                NODE_ENV: 'production',
                ORCHESTRATOR_MODE: 'daemon',
            },

            // Graceful shutdown
            kill_timeout: 10000,
            listen_timeout: 5000,
        },

        // Optional: Dashboard as separate process
        {
            name: 'cc-mirror-dashboard',
            script: 'npx',
            args: 'ts-node --transpile-only src/orchestrator/dashboard.ts',
            cwd: '/home/kasm-user/workspace/dspy/cc-mirror-ag-state-bridge',

            // Dashboard is optional, don't auto-start
            autorestart: false,
            watch: false,

            // Logging
            error_file: 'logs/dashboard-error.log',
            out_file: 'logs/dashboard-out.log',

            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
