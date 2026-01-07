# cc-mirror-ag-state-bridge

[![CI](https://github.com/azjam798276/cc-mirror-ag-state-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/azjam798276/cc-mirror-ag-state-bridge/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)](./coverage-report.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm version](https://img.shields.io/badge/npm-1.0.0-blue)](https://www.npmjs.com/package/cc-mirror-ag-state-bridge)

> **Antigravity Provider with State Bridge for cc-mirror**

Bridge your Antigravity IDE sessions to Claude Code CLI. Start work in Antigravity, seamlessly continue in Claude Code without losing context.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🔄 State Bridge** | Inject Antigravity session context into Claude Code conversations |
| **🔐 OAuth Manager** | Google OAuth 2.0 with PKCE and secure token storage via `keytar` |
| **🔀 Protocol Translation** | Automatic Gemini ↔ Anthropic message format conversion |
| **🛡️ Tool Hardening** | Mirrowel pattern for tool schema validation and hallucination prevention |
| **🧠 Thinking Sanitizer** | Filter internal `<thinking>` blocks from output |
| **📊 Session Discovery** | Auto-detect sessions in `~/.antigravity/sessions` |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- Claude Code CLI (`cc-mirror`) installed
- Antigravity IDE (optional, for session bridging)

### Installation

```bash
# Clone the repository
git clone https://github.com/azjam798276/cc-mirror-ag-state-bridge.git
cd cc-mirror-ag-state-bridge

# Install dependencies
npm install

# Build
npm run build
```

### Authentication

```bash
# Authenticate with Google (required for Antigravity API)
npx ts-node src/cli/index.ts antigravity login
```

---

## 📖 Usage

### Continue from Antigravity Session

```bash
# Auto-inject context from the latest Antigravity session
cc-mirror send --continue-from-ag "Add rate limiting to the API"
```

### List Available Sessions

```bash
# View recent Antigravity sessions
cc-mirror list-ag-sessions

# Output:
# Recent Antigravity Sessions:
#
# 1. session-abc123 (2 hours ago)
#    Goal: Build REST API with authentication
#    Progress: 3/5 steps completed
#
# 2. session-def456 (5 hours ago)
#    Goal: Fix database migration bug
#    Progress: Completed
```

### Continue from Specific Session

```bash
# Use a specific session by ID
cc-mirror send --ag-session session-abc123 "Add tests for auth"
```

### Show Session Details

```bash
cc-mirror show-ag-session session-abc123
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER WORKFLOW                            │
│  1. Work in Antigravity IDE                                 │
│  2. Switch to Claude Code CLI with --continue-from-ag       │
│  3. Claude Code sees your AG plan + progress                │
└────────────────────────────┬────────────────────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │        LAYER 1: State Bridge        │
          │  ┌────────────────────────────────┐ │
          │  │   Session Discovery            │ │
          │  │   Session Parser               │ │
          │  │   Context Injection Engine     │ │
          │  └────────────────────────────────┘ │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │     LAYER 2: Protocol Translation   │
          │  OAuth • API Translator • Tools     │
          └──────────────────┬──────────────────┘
                             │
                             ▼
                   Google Antigravity API
```

---

## 🧪 Development

### Run Tests

```bash
# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance benchmarks
npm run test:performance
```

### Linting

```bash
npm run lint
```

### Build

```bash
npm run build
```

---

## 📁 Project Structure

```
cc-mirror-ag-state-bridge/
├── src/
│   ├── cli/                  # CLI commands
│   ├── orchestrator/         # Dashboard, polling, phase detection
│   └── providers/
│       └── antigravity/
│           ├── oauth/        # OAuth manager, credential store
│           ├── state-bridge/ # Session discovery, parser, injector
│           ├── translation/  # Streaming handler, API translator
│           ├── account/      # Account pool, quota tracker
│           └── enhancement/  # Tool hardener, thinking sanitizer
├── tests/
│   ├── unit/                 # Unit tests (90%+ coverage)
│   ├── integration/          # Integration tests
│   └── performance/          # Benchmark tests
├── docs/                     # Documentation
├── skills/                   # Agent persona definitions
├── stories/                  # User stories
└── golden-examples/          # Few-shot examples
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AG_SESSION_DIR` | Custom session directory | `~/.antigravity/sessions` |
| `CC_MIRROR_DEBUG` | Enable debug logging | `false` |
| `AG_CLIENT_ID` | Google OAuth Client ID | — |
| `AG_CLIENT_SECRET` | Google OAuth Client Secret | — |

### Session Search Paths

1. `~/.antigravity/sessions/*.json`
2. `~/.config/antigravity/sessions/*.json` (Linux)
3. `%APPDATA%/Antigravity/sessions/*.json` (Windows)
4. `$AG_SESSION_DIR` (custom override)

---

## 📊 Coverage Report

| Metric | Coverage |
|--------|----------|
| **Lines** | 90.34% |
| **Statements** | 89% |
| **Branches** | 72% |
| **Functions** | 78% |

See [coverage-report.json](./coverage-report.json) for detailed metrics.

---

## 🔐 Security

- **PKCE** for OAuth flows
- **Encrypted tokens** at rest using system keychain (`keytar`) or AES-256-GCM fallback
- **No token logging** in traces or error outputs
- **Input validation** with strict schemas

See [docs/antigravity/troubleshooting.md](./docs/antigravity/troubleshooting.md) for security configuration.

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📬 Support

- **Issues:** [GitHub Issues](https://github.com/azjam798276/cc-mirror-ag-state-bridge/issues)
- **Docs:** [docs/antigravity/setup-guide.md](./docs/antigravity/setup-guide.md)
