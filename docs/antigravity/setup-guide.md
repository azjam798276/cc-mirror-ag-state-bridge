# Antigravity Setup Guide

This guide describes how to set up and use the Antigravity provider for `cc-mirror`, which enables the **State Bridge** capability to inject context from Antigravity sessions into your current coding environment.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **Google Cloud Console Project**: You need a Google Cloud project with OAuth 2.0 credentials configured.
- **Antigravity Sessions**: You must have Antigravity sessions (JSON files) accessible on your filesystem (e.g., in `~/.antigravity/sessions` or mapped via Docker volume).

## Installation

### Data Plane (NPM Package)

To install the `cc-mirror-ag-state-bridge` package globally:

```bash
npm install -g cc-mirror-ag-state-bridge
```

Or for local development:

```bash
git clone https://github.com/your-org/cc-mirror-ag-state-bridge.git
cd cc-mirror-ag-state-bridge
npm install
npm run build
npm link
```

## Configuration

The provider requires a `GEMINI.md` file (or environment variables) for configuration.

### Environment Variables

Set the following variables in your shell or `.env` file:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
# Optional: Override session directory
export AG_SESSION_DIR="/path/to/antigravity/sessions"
```

### GEMINI.md Configuration

You can also use a `GEMINI.md` configuration file in your home or workspace directory:

```markdown
# Configuration

## Antigravity Provider

- **ClientId**: `your-client-id.apps.googleusercontent.com`
- **ClientSecret**: `your-client-secret`
- **SessionDir**: `/path/to/sessions`
```

## First Time Setup: Authentication

Before using the bridge, you must authenticate with your Google account to access Antigravity API services (if applicable) or simply to authorize the CLI.

1.  Run the login command:
    ```bash
    cc-mirror antigravity login
    ```
2.  A browser window will open. Sign in with your Google account.
3.  Upon success, the CLI will display "Authentication successful". Tokens are securely stored in your OS keychain.

## Usage Examples

### 1. List Available Sessions

See which Antigravity sessions are discovered on your system:

```bash
cc-mirror antigravity list-sessions
```

Output:
```text
ID                                   Timestamp            Size    Goal
------------------------------------ -------------------  ------  -------------------------
5892bb1b-625e-4b5d-a10b-34d4aa2a45dc 2026-01-07 17:00:00  12KB    Implement OAuth Manager
a1b2c3d4-e5f6-7890-1234-567890abcdef 2026-01-06 14:30:00  45KB    Refactor API Layer
```

### 2. Inspect a Session

View details of a specific session to verify its content:

```bash
cc-mirror antigravity show-session 5892bb1b-625e-4b5d-a10b-34d4aa2a45dc
```

### 3. Send Request with Context

Inject the context from the latest Antigravity session into your prompt:

```bash
cc-mirror send "Refactor the authentication logic based on my previous planning" --continue-from-ag
```

Or specify a specific session ID:

```bash
cc-mirror send "Fix the bug in the parser" --ag-session 5892bb1b-625e-4b5d-a10b-34d4aa2a45dc
```

## Advanced Features

### Tool Hardening
The bridge automatically applies "Tool Hardening" parameters to API requests, preventing hallucination by injecting strict implementation constraints into the system prompt.

### Thinking Sanitizer
Use the `--no-thinking` flag if you want to strip `<thinking>` blocks from the output for a cleaner console view.
