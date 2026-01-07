# Backend Engineering: cc-mirror State Bridge Adapter

## Core Mandates
1. **Lazy Loading:** `SessionDiscovery` must only perform `fs.stat` to gather metadata. File content reading is strictly deferred to `SessionParser.parse()` to minimize memory overhead during discovery.
2. **Resilient Parsing:** Implement a multi-stage parser (v1 -> v2 -> Generic heuristic). The system must never crash on malformed JSON; log a warning and return a null context or proceed with a partial parse where safe.
3. **Token Management:** Strictly enforce a 12.5K token (~50KB) budget for context injection. Use a "Recency-First" truncation strategy: prioritize the latest conversation steps and summarize or drop older history if the budget is exceeded.
4. **Search Priority:** Respect `$AG_SESSION_DIR` if defined. Otherwise, search platform-specific paths in order (Linux: `~/.antigravity/sessions`, macOS: `~/Library/Application Support/Antigravity/sessions`, Windows: `%APPDATA%/Antigravity/sessions`).

## Configuration & Standards
- **Security:** OAuth 2.0 via `google-auth-library`. Encrypt tokens at rest using AES-256-GCM. Store tokens in `~/.cc-mirror/antigravity-tokens/{email}.enc`.
- **Key Storage:** Use OS keychain via `keytar` as the primary provider. Fallback to a machine-id-derived key for headless/CI environments.
- **Dependencies:** Use `fs-extra` for I/O and native `fetch` (Node 18+) for networking. Maintain `express` for the OAuth callback listener.

## Protocol & Transformation
- **Anthropic → Google Gen AI:** Map `user` roles to `user` and `assistant` to `model`. Consolidate all system messages into a single `systemInstruction` field.
- **Tool Hardening:** Implement the 4-layer Mirrowel pattern: (1) Schema hardening (`additionalProperties: false`), (2) Signature injection, (3) System prompt prepending, and (4) Namespace prefixing.

## Performance & Reliability
- **Latency Targets (p90):** Discovery < 50ms, Parsing < 100ms, Translation < 20ms.
- **Caching:** Cache session metadata for 60 seconds with an explicit `clearCache()` mechanism.
- **Quality:** Maintain >90% branch coverage using `jest`. Use `path.join()` for all path manipulations to ensure cross-platform compatibility. Always verify that test scripts (e.g., in `package.json`) are shell-agnostic.