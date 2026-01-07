# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-07

### Added
- **State Bridge**: Context Injection from Antigravity sessions (`.json` files) into the current provider stream.
- **Session Discovery**: Automatic detection of session files in `~/.antigravity/sessions` or custom directories.
- **OAuth Manager**: Google OAuth 2.0 flow for authentication with secure token storage via `keytar`.
- **Protocol Translation**: Automatic conversion of Antigravity (Gemini) message formats to Anthropic/CC-Mirror compatible formats.
- **Tool Hardening**: Middleware to inject rigid schema constraints and prevent tool hallucination (Mirrowel Pattern).
- **Thinking Sanitizer**: Optional filtering of internal `<thinking>` blocks from the output.
- **CLI Commands**:
  - `cc-mirror antigravity login`: Authenticate with Google.
  - `cc-mirror antigravity list-sessions`: View available contexts.
  - `cc-mirror send --continue-from-ag`: Inject the latest session context.

### Changed
- Refactored `AntigravityProvider` to use modular architecture (Discovery, Parser, Injector).
- Updated logging to support `DEBUG=cc-mirror:*` namespaces.

### Security
- Implemented PKCE for OAuth flows.
- Tokens are encrypted at rest using system keychain or AES-256-GCM fallback.
