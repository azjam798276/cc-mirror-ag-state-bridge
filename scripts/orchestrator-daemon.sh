#!/bin/bash
# Orchestrator Daemon - Runs as background service
# Supports: start, stop, status, restart, logs
#
# Usage:
#   ./scripts/orchestrator-daemon.sh start   - Start daemon
#   ./scripts/orchestrator-daemon.sh stop    - Stop daemon
#   ./scripts/orchestrator-daemon.sh status  - Check status
#   ./scripts/orchestrator-daemon.sh restart - Restart daemon
#   ./scripts/orchestrator-daemon.sh logs    - View logs

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.orchestrator.pid"
LOG_FILE="$PROJECT_DIR/logs/orchestrator.log"
ERROR_LOG="$PROJECT_DIR/logs/orchestrator.error.log"

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[Orchestrator]${NC} $1"
}

error() {
    echo -e "${RED}[Orchestrator]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[Orchestrator]${NC} $1"
}

get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

is_running() {
    local pid=$(get_pid)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

start_daemon() {
    if is_running; then
        warn "Daemon is already running (PID: $(get_pid))"
        return 1
    fi

    log "Starting orchestrator daemon..."
    
    cd "$PROJECT_DIR"
    
    # Start the orchestrator in background with nohup
    nohup npx ts-node --transpile-only src/orchestrator/phase-detector.ts \
        >> "$LOG_FILE" 2>> "$ERROR_LOG" &
    
    local pid=$!
    echo $pid > "$PID_FILE"
    
    # Wait a moment and check if it started successfully
    sleep 2
    
    if is_running; then
        log "Daemon started successfully (PID: $pid)"
        log "Logs: $LOG_FILE"
    else
        error "Failed to start daemon. Check logs: $ERROR_LOG"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop_daemon() {
    if ! is_running; then
        warn "Daemon is not running"
        rm -f "$PID_FILE"
        return 0
    fi

    local pid=$(get_pid)
    log "Stopping daemon (PID: $pid)..."
    
    # Send SIGTERM for graceful shutdown
    kill -TERM "$pid" 2>/dev/null
    
    # Wait up to 10 seconds for graceful shutdown
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        warn "Graceful shutdown failed, force killing..."
        kill -9 "$pid" 2>/dev/null
    fi
    
    rm -f "$PID_FILE"
    log "Daemon stopped"
}

status_daemon() {
    if is_running; then
        local pid=$(get_pid)
        log "Daemon is running (PID: $pid)"
        
        # Show some stats
        if [ -f "$LOG_FILE" ]; then
            local lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
            log "Log lines: $lines"
            log "Last activity:"
            tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
        fi
    else
        warn "Daemon is not running"
        if [ -f "$PID_FILE" ]; then
            warn "Stale PID file exists, cleaning up..."
            rm -f "$PID_FILE"
        fi
    fi
}

restart_daemon() {
    log "Restarting daemon..."
    stop_daemon
    sleep 1
    start_daemon
}

view_logs() {
    if [ -f "$LOG_FILE" ]; then
        log "Viewing logs (Ctrl+C to exit)..."
        tail -f "$LOG_FILE"
    else
        warn "No log file found at $LOG_FILE"
    fi
}

rotate_logs() {
    log "Rotating logs..."
    
    if [ -f "$LOG_FILE" ]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        mv "$LOG_FILE" "$PROJECT_DIR/logs/orchestrator.$timestamp.log"
        log "Rotated to: orchestrator.$timestamp.log"
    fi
    
    if [ -f "$ERROR_LOG" ]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        mv "$ERROR_LOG" "$PROJECT_DIR/logs/orchestrator.error.$timestamp.log"
    fi
    
    # Keep only last 5 log files
    cd "$PROJECT_DIR/logs"
    ls -t orchestrator.*.log 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
    ls -t orchestrator.error.*.log 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
    
    log "Log rotation complete"
}

# Main command handler
case "${1:-help}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    restart)
        restart_daemon
        ;;
    logs)
        view_logs
        ;;
    rotate)
        rotate_logs
        ;;
    help|--help|-h)
        echo "Orchestrator Daemon - Background Service Manager"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start    Start the orchestrator daemon"
        echo "  stop     Stop the orchestrator daemon"
        echo "  status   Check daemon status"
        echo "  restart  Restart the daemon"
        echo "  logs     View logs (tail -f)"
        echo "  rotate   Rotate log files"
        echo "  help     Show this help"
        echo ""
        echo "Files:"
        echo "  PID:    $PID_FILE"
        echo "  Logs:   $LOG_FILE"
        echo "  Errors: $ERROR_LOG"
        ;;
    *)
        error "Unknown command: $1"
        echo "Run '$0 help' for usage"
        exit 1
        ;;
esac
