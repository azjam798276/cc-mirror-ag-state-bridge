# Troubleshooting Antigravity State Bridge

This document provides solutions to common issues encountered when using the Antigravity Provider for `cc-mirror`.

## Common Issues

### 1. "No active Antigravity session found"

**Symptom:**
Running `cc-mirror send --continue-from-ag` returns an error stating no session was found.

**Cause:**
- The configured session directory is empty.
- The `AG_SESSION_DIR` environment variable points to the wrong location.
- File permissions prevent reading the session files.

**Solution:**
- Verify your session directory contains `.json` files.
- Run `cc-mirror antigravity list-sessions` to see what the CLI detects.
- Check permissions: `ls -l ~/.antigravity/sessions`.

### 2. OAuth Authentication Fails

**Symptom:**
Running `login` hangs or returns a timeout error.

**Cause:**
- Port `51121` (callback port) is in use.
- Firewall is blocking the callback request.
- Invalid Client ID/Secret.
- Mismatch in Redirect URI configuration in Google Cloud Console.

**Solution:**
- Ensure port 51121 is free: `lsof -i :51121`.
- Verify your Google Cloud Console credentials have `http://localhost:51121/callback` as an authorized redirect URI.
- Check `DEBUG=cc-mirror:oauth` logs for specific error messages.

### 3. "Session too large" Error

**Symptom:**
The CLI refuses to process a session file.

**Cause:**
The session file exceeds the 50MB safety limit, or the token count exceeds the context window after truncation.

**Solution:**
- The bridge automatically truncates older steps. If the *essential* context (file definitions, final state) is massive, you may need to summarize the session manually or increase the limit in source if you have sufficient RAM/Context.

## Debugging

To enable verbose logging, set the `DEBUG` environment variable:

```bash
# Linux/macOS
export DEBUG=cc-mirror:*
cc-mirror send ...
```

For specific modules:
- OAuth: `DEBUG=cc-mirror:oauth`
- Discovery: `DEBUG=cc-mirror:discovery`
- Context Injection: `DEBUG=cc-mirror:injector`

## FAQ

**Q: Where are my tokens stored?**
A: Tokens are stored securely using your operating system's keychain via the `keytar` library. On Linux configurations without a desktop environment/keyring, it may fallback to a protected file or require a mock implementation (see `SecureStorage`).

**Q: Does this work with Claude/Anthropic directly?**
A: This bridge is designed to translate the Antigravity context (often Gemini-based) into a format compatible with the target model. If you are targeting Anthropic models via `cc-mirror`, the `MessageTransformer` handles the conversion automatically.

**Q: Can I use this in a CI/CD pipeline?**
A: Yes, but you must provide the OAuth Refresh Token via secret environment variables, as interactive login is not possible in CI.
